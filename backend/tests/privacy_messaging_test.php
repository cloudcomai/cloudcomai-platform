<?php
declare(strict_types=1);

if (getenv('CLOUDCOMAI_RUN_DB_TESTS') !== '1') {
    fwrite(STDERR, "Set CLOUDCOMAI_RUN_DB_TESTS=1 to run the local MySQL integration suite.\n");
    exit(1);
}
$database = 'cloudcomai_test_' . bin2hex(random_bytes(6));
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
    $payload = $id . '|' . time() . '|test';
    return base64_encode($payload . '|' . hash_hmac('sha256', $payload, 'integration-test-secret'));
}
function request(string $method, string $path, int $user, mixed $body = null, int $expected = 200, array $headers = []): array {
    $headers[] = 'Authorization: Bearer ' . test_token($user);
    if (is_array($body)) {
        $body = json_encode($body);
        $headers[] = 'Content-Type: application/json';
    } elseif (is_string($body) && $body !== '') {
        $headers[] = 'Content-Length: ' . strlen($body);
    }
    $formattedHeaders = [];
    foreach ($headers as $name => $value) {
        $formattedHeaders[] = is_string($name) ? $name . ': ' . $value : $value;
    }
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $formattedHeaders), 'content' => $body ?? '', 'ignore_errors' => true, 'timeout' => 10]]);
    $raw = file_get_contents('http://127.0.0.1:18765/' . $path, false, $context);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $match);
    $status = (int)($match[1] ?? 0);
    check($status === $expected, "$method $path returned $status, expected $expected: " . substr((string)$raw, 0, 500));
    return ['data' => json_decode((string)$raw, true), 'raw' => $raw, 'headers' => $http_response_header];
}

try {
    $admin->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $admin->exec("USE `$database`");
    $admin->exec(file_get_contents(__DIR__ . '/../database/fresh-install.sql'));
    $admin->exec("DELETE FROM chats WHERE type='public' AND group_category='india-city'");
    $admin->exec("ALTER TABLE chats AUTO_INCREMENT=1");
    $admin->exec('DROP TABLE user_blocks, user_privacy_settings');
    $migration = file_get_contents(__DIR__ . '/../database/migrations/006_privacy_and_security.sql');
    $admin->exec($migration); $admin->exec($migration);
    $admin->exec("INSERT INTO users(id,user_id,name,email,password_hash,dob,gender,updated_at) VALUES (1,'alice','Alice','alice@example.test','not-exported','1990-01-01','Female',UTC_TIMESTAMP()),(2,'bob','Bob','bob@example.test','not-exported','1990-01-01','Male',UTC_TIMESTAMP()),(3,'outsider','Outsider','outsider@example.test','not-exported','1990-01-01','Male',UTC_TIMESTAMP())");
    $admin->exec("INSERT INTO chats(id,type,owner_id) VALUES(1,'private',1),(2,'group',1)");
    $admin->exec("INSERT INTO chat_members(chat_id,user_id,role,status) VALUES(1,1,'member','active'),(1,2,'member','active'),(2,1,'owner','active'),(2,2,'member','active')");

    copy_backend(dirname(__DIR__), $root);
