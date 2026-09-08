<?php
declare(strict_types=1);

// This suite creates an isolated database and backend copy on localhost only.
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
    if (is_array($body)) { $body = json_encode($body); $headers[] = 'Content-Type: application/json'; }
    $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body ?? '', 'ignore_errors' => true, 'timeout' => 10]]);
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
    // Incremental migration is idempotent and agrees with the fresh-install schema.
    $admin->exec('DROP TABLE user_blocks, user_privacy_settings');
    $migration = file_get_contents(__DIR__ . '/../database/migrations/006_privacy_and_security.sql');
    $admin->exec($migration); $admin->exec($migration);
    $admin->exec("INSERT INTO users(id,user_id,name,email,password_hash,dob,gender,updated_at) VALUES (1,'alice','Alice','alice@example.test','not-exported','1990-01-01','Female',UTC_TIMESTAMP()),(2,'bob','Bob','bob@example.test','not-exported','1990-01-01','Male',UTC_TIMESTAMP()),(3,'outsider','Outsider','outsider@example.test','not-exported','1990-01-01','Male',UTC_TIMESTAMP())");
    $admin->exec("INSERT INTO chats(id,type,owner_id) VALUES(1,'private',1)");
    $admin->exec("INSERT INTO chat_members(chat_id,user_id,role,status) VALUES(1,1,'member','active'),(1,2,'member','active')");

    copy_backend(dirname(__DIR__), $root);
    $config = ['db' => ['host'=>'127.0.0.1','name'=>$database,'user'=>'root','pass'=>$password,'charset'=>'utf8mb4'], 'app'=>['token_secret'=>'integration-test-secret','allowed_origins'=>[]]];
    file_put_contents($root . '/config/config.php', '<?php return ' . var_export($config, true) . ';');
    $process = proc_open([PHP_BINARY, '-S', '127.0.0.1:18765', '-t', $root . '/api', $root . '/api/index.php'], [0=>['pipe','r'],1=>['file',$root.'/server.log','a'],2=>['file',$root.'/server.log','a']], $pipes);
    check(is_resource($process), 'Unable to start local test API');
    for ($attempt=0; $attempt<50; $attempt++) {
        $socket = @fsockopen('127.0.0.1', 18765, $errno, $errstr, .1);
        if ($socket) { fclose($socket); break; }
        usleep(100000);
    }
    $settings = request('GET','v1/users/privacy',1)['data'];
    request('POST','v1/notifications/device-token',2,['token'=>'ExponentPushToken[integration-test-only]','platform'=>'ANDROID']);
    check($settings['settings']['screenshot_alerts'] === true, 'Screenshot alerts default');
    request('PUT','v1/users/privacy',1,['hide_online_status'=>true]);
    request('PUT','v1/users/privacy',1,['hide_online_status'=>'invalid'],400);
    $users = request('GET','v1/users',2)['data']['users'];
    $alice = array_values(array_filter($users, fn($u)=>(int)$u['id']===1))[0];
    check(!$alice['online'] && !isset($alice['updated_at']), 'Hidden presence leaked');

    $profile = request('GET','v1/users/profile?id=1',2)['data']['user'];
    check($profile['name']==='Alice' && $profile['age']>=18 && $profile['gender']==='Female','Shared contact profile fields missing');
    check($profile['email']==='alice@example.test' && $profile['mobile']===null,'Optional contact fields invalid');
    check(!array_key_exists('dob',$profile),'Profile exposed date of birth instead of derived age');
    request('GET','v1/users/profile?id=1',3,null,403);

    $message = request('POST','v1/messages',1,['chat_id'=>1,'body'=>'searchable hello'],201)['data']['message'];
    $id = (int)$message['id'];
    request('GET','v1/messages?chat_id=1',3,null,403);
    check(count(request('GET','v1/messages?chat_id=1&q=searchable',2)['data']['messages'])===1, 'Message search failed');
    request('DELETE',"v1/messages?id=$id&scope=everyone",2,null,403);
    request('DELETE',"v1/messages?id=$id&scope=self",2);
    $sync = request('GET',"v1/messages?chat_id=1&after_id=$id",2)['data'];
    check(in_array($id,$sync['removed_ids'],true), 'Self deletion missing from synchronization');
    check(count(request('GET','v1/messages?chat_id=1&q=searchable',2)['data']['messages'])===0, 'Hidden message leaked through search');
    check(count(request('GET','v1/messages?chat_id=1',1)['data']['messages'])===1, 'Self deletion affected sender');
    request('DELETE',"v1/messages?id=$id&scope=everyone",1);
    check(count(request('GET','v1/messages?chat_id=1',1)['data']['messages'])===0, 'Global deletion failed');

    $edit = request('POST','v1/messages',1,['chat_id'=>1,'body'=>'before edit'],201)['data']['message'];
    request('POST','v1/messages/edit',1,['editing_id'=>$edit['id'],'body'=>'after edit']);
    $sync = request('GET','v1/messages?chat_id=1&after_id='.$edit['id'].'&updated_after=2000-01-01%2000%3A00%3A00',2)['data'];
    check(($sync['messages'][0]['body']??'')==='after edit','Old message edit did not synchronize');
    request('POST','v1/messages',1,['chat_id'=>1,'type'=>'location','latitude'=>91,'longitude'=>0],400);
    $location = request('POST','v1/messages',1,['chat_id'=>1,'type'=>'location','latitude'=>0,'longitude'=>0],201)['data']['message'];
    request('POST','v1/messages/edit',1,['message_id'=>$location['id'],'body'=>'corrupt location'],409);

    request('POST','v1/users/privacy',2,['user_id'=>1],201);
    request('GET','v1/users/profile?id=1',2,null,403);
    request('POST','v1/messages',1,['chat_id'=>1,'body'=>'blocked'],403);
    request('POST','v1/messages',2,['chat_id'=>1,'body'=>'also blocked'],403);
    request('POST','v1/messages',1,['chat_id'=>1,'type'=>'location','latitude'=>0,'longitude'=>0],403);
    request('POST','v1/polls',1,['chat_id'=>1,'question'=>'Blocked?','options'=>['Yes','No']],403);
    request('DELETE','v1/users/privacy?user_id=1',2);

    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
    check(is_string($png),'Unable to prepare image upload fixture');
    $imageBoundary = 'CloudComAIImageUploadTest';
    $imageMultipart = '';
    foreach (['chat_id'=>'1','original_filename'=>'camera-photo.png','download_policy'=>'APPROVAL_REQUIRED'] as $key=>$value) $imageMultipart .= "--$imageBoundary\r\nContent-Disposition: form-data; name=\"$key\"\r\n\r\n$value\r\n";
    $imageMultipart .= "--$imageBoundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"upload.bin\"\r\nContent-Type: application/octet-stream\r\n\r\n$png\r\n--$imageBoundary--\r\n";
    $imageMessage = request('POST','v1/attachments/upload',1,$imageMultipart,201,['Content-Type: multipart/form-data; boundary='.$imageBoundary])['data']['message'];
    check($imageMessage['attachment']['name']==='camera-photo.png','Native upload filename was not preserved');
    $imageAttachmentId = (int)$imageMessage['attachment']['id'];
    $admin->exec("UPDATE message_attachments SET mime_type='application/octet-stream' WHERE id=$imageAttachmentId");
    check(request('GET',"v1/attachments?id=$imageAttachmentId&preview=1",2)['raw']===$png,'Image preview MIME recovery failed');
    request('DELETE','v1/messages?id='.$imageMessage['id'].'&scope=everyone',1);

    request('PUT','v1/users/privacy',2,['screenshot_alerts'=>false]);
    check(request('POST','v1/security/screenshot',1,['chat_id'=>1],201)['data']['notified_users']===0,'Screenshot opt-out ignored');
    request('PUT','v1/users/privacy',2,['screenshot_alerts'=>true]);
    check(request('POST','v1/security/screenshot',1,['chat_id'=>1],201)['data']['notified_users']===1,'Screenshot recipient missing');
    request('POST','v1/security/screenshot',3,['chat_id'=>1],403);

    $wav = 'RIFF'.pack('V',36+8000).'WAVEfmt '.pack('VvvVVvv',16,1,1,8000,8000,1,8).'data'.pack('V',8000).str_repeat(chr(128),8000);
    $boundary = 'CloudComAIIntegrationTest';
    $multipart = '';
    foreach (['chat_id'=>'1','message_type'=>'voice','download_policy'=>'APPROVAL_REQUIRED'] as $key=>$value) $multipart .= "--$boundary\r\nContent-Disposition: form-data; name=\"$key\"\r\n\r\n$value\r\n";
    $multipart .= "--$boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"voice.wav\"\r\nContent-Type: audio/wav\r\n\r\n$wav\r\n--$boundary--\r\n";
    $voice = request('POST','v1/attachments/upload',1,$multipart,201,['Content-Type: multipart/form-data; boundary='.$boundary])['data']['message'];
    check($voice['type']==='voice','Voice upload lost message type');
    $attachmentId = $voice['attachment']['id'];
    request('GET',"v1/attachments?id=$attachmentId&preview=1",3,null,404);
    check(request('GET',"v1/attachments?id=$attachmentId&preview=1",2)['raw']===$wav,'Audio preview corrupt');
    check(strlen(request('GET',"v1/attachments?id=$attachmentId&preview=1",2,null,206,['Range: bytes=0-9'])['raw'])===10,'Media range response invalid');
    request('GET',"v1/attachments?id=$attachmentId",2,null,403);
    request('DELETE','v1/messages?id='.$voice['id'].'&scope=self',2);
    request('GET',"v1/attachments?id=$attachmentId&preview=1",2,null,404);
    $backup = request('GET','v1/users/backup',2)['data'];
    check(!isset($backup['profile']['password_hash']) && count($backup['attachments'])===0,'Backup leaked credentials or hidden attachment');
    request('DELETE','v1/messages?id='.$voice['id'].'&scope=everyone',1);
    request('GET',"v1/attachments?id=$attachmentId&preview=1",1,null,404);
    check(count(glob($root.'/storage/attachments/*'))===0,'Deleted media bytes remain on disk');
    echo "Profiles, privacy, search, deletion, location, screenshot, media access, backup, and migration integration tests passed\n";
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    if (is_file($root.'/server.log')) fwrite(STDERR, file_get_contents($root.'/server.log'));
    $failed = true;
} finally {
    if (is_resource($process)) { proc_terminate($process); proc_close($process); }
    $admin->exec("DROP DATABASE IF EXISTS `$database`");
    if (is_dir($root)) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($root);
    }
}
exit(empty($failed) ? 0 : 1);
