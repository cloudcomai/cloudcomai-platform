<?php
declare(strict_types=1);

if (getenv('CLOUDCOMAI_RUN_DB_TESTS') !== '1') {
    fwrite(STDERR, "Set CLOUDCOMAI_RUN_DB_TESTS=1 to run the local MySQL integration suite.\n");
    exit(1);
}

$database = 'cloudcomai_edit_test_' . bin2hex(random_bytes(5));
$password = getenv('CLOUDCOMAI_TEST_DB_PASSWORD') ?: '';
$admin = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$root = sys_get_temp_dir() . '/' . $database;
$process = null;

function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function copy_backend(string $source, string $target): void {
    mkdir($target, 0700, true);
    foreach (new DirectoryIterator($source) as $entry) {
        if ($entry->isDot() || in_array($entry->getFilename(), ['storage', 'config.php'], true)) continue;
        $dest = $target . '/' . $entry->getFilename();
        if ($entry->isDir()) copy_backend($entry->getPathname(), $dest);
        else copy($entry->getPathname(), $dest);
    }
}
function test_token(int $id): string {
    $payload = $id . '|' . time() . '|edit-policy-test';
    return base64_encode($payload . '|' . hash_hmac('sha256', $payload, 'edit-policy-test-secret'));
}
function request(string $method, string $path, int $user, mixed $body = null, int $expected = 200): array {
    $headers = ['Authorization: Bearer ' . test_token($user)];
    if (is_array($body)) {
        $body = json_encode($body);
        $headers[] = 'Content-Type: application/json';
    }
    $context = stream_context_create(['http' => [
        'method' => $method,
        'header' => implode("\r\n", $headers),
        'content' => $body ?? '',
        'ignore_errors' => true,
        'timeout' => 10,
    ]]);
    $raw = file_get_contents('http://127.0.0.1:18766/' . $path, false, $context);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $match);
    $status = (int)($match[1] ?? 0);
    check($status === $expected, "$method $path returned $status, expected $expected: " . substr((string)$raw, 0, 500));
    return json_decode((string)$raw, true) ?: [];
}

try {
    $admin->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $admin->exec("USE `$database`");
    $admin->exec(file_get_contents(__DIR__ . '/../database/fresh-install.sql'));
    $admin->exec("DELETE FROM chats WHERE type='public' AND group_category='india-city'");
    $admin->exec("DELETE FROM chats WHERE type='public' AND room_type='language'");
    $admin->exec("ALTER TABLE chats AUTO_INCREMENT=1");
    $admin->exec("INSERT INTO users(id,user_id,name,email,password_hash,dob,gender,updated_at) VALUES (1,'alice','Alice','alice@example.test','not-exported','1990-01-01','Female',UTC_TIMESTAMP()),(2,'bob','Bob','bob@example.test','not-exported','1990-01-01','Male',UTC_TIMESTAMP())");
    $admin->exec("INSERT INTO chats(id,type,owner_id,created_at) VALUES(1,'private',1,UTC_TIMESTAMP())");
    $admin->exec("INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(1,1,'member','active',UTC_TIMESTAMP()),(1,2,'member','active',UTC_TIMESTAMP())");

    copy_backend(dirname(__DIR__), $root);
    $config = ['db' => ['host'=>'127.0.0.1','name'=>$database,'user'=>'root','pass'=>$password,'charset'=>'utf8mb4'], 'app'=>['token_secret'=>'edit-policy-test-secret','backup_encryption_key'=>'edit-policy-test-backup-key-32-bytes-only','backup_cron_secret'=>'edit-policy-test-cron-secret','allowed_origins'=>[]]];
    file_put_contents($root . '/config/config.php', '<?php return ' . var_export($config, true) . ';');
    $process = proc_open([PHP_BINARY, '-S', '127.0.0.1:18766', '-t', $root . '/api', $root . '/api/index.php'], [0=>['pipe','r'],1=>['file',$root.'/server.log','a'],2=>['file',$root.'/server.log','a']], $pipes);
    check(is_resource($process), 'Unable to start local test API');
    for ($attempt=0; $attempt<50; $attempt++) {
        $socket = @fsockopen('127.0.0.1', 18766, $errno, $errstr, .1);
        if ($socket) { fclose($socket); break; }
        usleep(100000);
    }

    $message = request('POST', 'v1/messages', 1, ['chat_id'=>1,'body'=>'original'], 201)['message'];
    $id = (int)$message['id'];
    request('POST', 'v1/messages/edit', 2, ['message_id'=>$id,'body'=>'not yours'], 404);
    request('POST', 'v1/messages/edit', 1, ['message_id'=>$id,'body'=>'first edit']);
    check((int)$admin->query("SELECT edit_count FROM messages WHERE id=$id")->fetchColumn() === 1, 'First edit must increment edit_count to 1');
    request('POST', 'v1/messages/edit', 1, ['message_id'=>$id,'body'=>'second edit']);
    $row = $admin->query("SELECT body,edit_count,created_at,edited_at FROM messages WHERE id=$id")->fetch(PDO::FETCH_ASSOC);
    check($row['body'] === 'second edit', 'Second edit did not update content');
    check((int)$row['edit_count'] === 2, 'Second edit must increment edit_count to 2');
    check($row['edited_at'] !== null, 'edited_at was not recorded');
    request('POST', 'v1/messages/edit', 1, ['message_id'=>$id,'body'=>'third edit'], 409);

    $fresh = request('POST', 'v1/messages', 1, ['chat_id'=>1,'body'=>'expired original'], 201)['message'];
    $expiredId = (int)$fresh['id'];
    $admin->exec("UPDATE messages SET created_at=UTC_TIMESTAMP() - INTERVAL 10801 SECOND WHERE id=$expiredId");
    request('POST', 'v1/messages/edit', 1, ['message_id'=>$expiredId,'body'=>'too late'], 409);
    $expiredRow = $admin->query("SELECT body,edit_count,edited_at FROM messages WHERE id=$expiredId")->fetch(PDO::FETCH_ASSOC);
    check($expiredRow['body'] === 'expired original' && (int)$expiredRow['edit_count'] === 0 && $expiredRow['edited_at'] === null, 'Expired message was modified');

    $boundary = request('POST', 'v1/messages', 1, ['chat_id'=>1,'body'=>'boundary'], 201)['message'];
    $boundaryId = (int)$boundary['id'];
    $admin->exec("UPDATE messages SET created_at=UTC_TIMESTAMP()-INTERVAL 3 HOUR WHERE id=$boundaryId");
    request('POST', 'v1/messages/edit', 1, ['message_id'=>$boundaryId,'body'=>'boundary edit']);
    check((int)$admin->query("SELECT edit_count FROM messages WHERE id=$boundaryId")->fetchColumn() === 1, 'Three-hour boundary should remain editable');

    $sync = request('GET', 'v1/messages?chat_id=1&after_id=' . $boundaryId . '&updated_after=2000-01-01%2000%3A00%3A00', 2)['messages'];
    $synced = array_values(array_filter($sync, fn($item) => (int)$item['id'] === $boundaryId));
    check(($synced[0]['body'] ?? '') === 'boundary edit', 'Edited content did not synchronize');
    check((int)($synced[0]['edit_count'] ?? 0) === 1 && !empty($synced[0]['edited_at']), 'Edit metadata did not synchronize');

    echo "Edit message policy integration tests passed.\n";
} finally {
    if (is_resource($process)) proc_terminate($process);
    if (is_dir($root)) {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $entry) $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
        rmdir($root);
    }
    try { $admin->exec("DROP DATABASE IF EXISTS `$database`"); } catch (Throwable) {}
}
