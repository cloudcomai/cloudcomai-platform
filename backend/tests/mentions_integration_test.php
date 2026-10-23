<?php
declare(strict_types=1);

if (getenv('CLOUDCOMAI_RUN_DB_TESTS') !== '1') {
    fwrite(STDERR, "Set CLOUDCOMAI_RUN_DB_TESTS=1 to run the MySQL @Mentions integration suite.\n");
    exit(1);
}

$database = 'cloudcomai_mentions_test_' . bin2hex(random_bytes(5));
$password = getenv('CLOUDCOMAI_TEST_DB_PASSWORD') ?: '';
$admin = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', $password, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$root = sys_get_temp_dir() . '/' . $database;
$process = null;
$port = 18767;

function mention_check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function mention_copy_backend(string $source, string $target): void {
    mkdir($target, 0700, true);
    foreach (new DirectoryIterator($source) as $entry) {
        if ($entry->isDot() || in_array($entry->getFilename(), ['storage', 'config.php'], true)) continue;
        $dest = $target . '/' . $entry->getFilename();
        if ($entry->isDir()) mention_copy_backend($entry->getPathname(), $dest);
        else copy($entry->getPathname(), $dest);
    }
}
function mention_token(int $id): string {
    $payload = $id . '|' . time() . '|mentions-test';
    return base64_encode($payload . '|' . hash_hmac('sha256', $payload, 'mentions-test-secret'));
}
function mention_request(string $method, string $path, int $userId, mixed $body = null, int $expected = 200): array {
    global $port;
    $headers = ['Authorization: Bearer ' . mention_token($userId)];
    if (is_array($body)) { $body=json_encode($body); $headers[]='Content-Type: application/json'; }
    $context = stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$body ?? '','ignore_errors'=>true,'timeout'=>10]]);
    $raw = file_get_contents('http://127.0.0.1:' . $port . '/' . $path, false, $context);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $match);
    $status = (int)($match[1] ?? 0);
    mention_check($status === $expected, "$method $path returned $status, expected $expected: " . substr((string)$raw,0,400));
    return json_decode((string)$raw, true) ?: [];
}

try {
    $admin->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $admin->exec("USE `$database`");
    $admin->exec(file_get_contents(__DIR__ . '/../database/fresh-install.sql'));
    $admin->exec("DELETE FROM chats WHERE type='public' AND (group_category='india-city' OR room_type='language')");
    $admin->exec("ALTER TABLE chats AUTO_INCREMENT=1");
    $admin->exec("INSERT INTO users(id,user_id,name,email,password_hash,dob,gender,account_status,updated_at) VALUES
        (1,'alice','Alice','alice@example.test','not-exported','1990-01-01','Female','active',UTC_TIMESTAMP()),
        (2,'bob','Bob','bob@example.test','not-exported','1990-01-01','Male','active',UTC_TIMESTAMP()),
        (3,'cara','Cara','cara@example.test','not-exported','1990-01-01','Female','active',UTC_TIMESTAMP()),
        (4,'dave','Dave','dave@example.test','not-exported','1990-01-01','Male','suspended',UTC_TIMESTAMP())");
    $admin->exec("INSERT INTO chats(id,type,name,owner_id,created_at) VALUES
        (1,'group','Engineering',1,UTC_TIMESTAMP()),
        (2,'public','Hyderabad',NULL,UTC_TIMESTAMP()),
        (3,'private','Private chat',1,UTC_TIMESTAMP())");
    $admin->exec("INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES
        (1,1,'owner','active',UTC_TIMESTAMP()),(1,2,'member','active',UTC_TIMESTAMP()),
        (1,3,'member','active',UTC_TIMESTAMP()),(1,4,'member','active',UTC_TIMESTAMP()),
        (2,1,'member','active',UTC_TIMESTAMP()),(2,2,'member','active',UTC_TIMESTAMP()),
        (3,1,'member','active',UTC_TIMESTAMP()),(3,2,'member','active',UTC_TIMESTAMP())");

    mention_copy_backend(dirname(__DIR__), $root);
    $config = ['db'=>['host'=>'127.0.0.1','name'=>$database,'user'=>'root','pass'=>$password,'charset'=>'utf8mb4'],
        'app'=>['token_secret'=>'mentions-test-secret','backup_encryption_key'=>'mentions-test-backup-key-32-bytes-only','backup_cron_secret'=>'mentions-test-cron-secret','allowed_origins'=>[]]];
    file_put_contents($root . '/config/config.php', '<?php return ' . var_export($config,true) . ';');
    $process = proc_open([PHP_BINARY,'-S','127.0.0.1:' . $port,'-t',$root . '/api',$root . '/api/index.php'],
        [0=>['pipe','r'],1=>['file',$root.'/server.log','a'],2=>['file',$root.'/server.log','a']],$pipes);
    mention_check(is_resource($process),'Unable to start test API');
    for ($attempt=0;$attempt<50;$attempt++) {
        $socket=@fsockopen('127.0.0.1',$port,$errno,$errstr,.1);
        if ($socket) { fclose($socket); break; }
        usleep(100000);
    }

    $sent = mention_request('POST','v1/messages',1,['chat_id'=>1,'body'=>'Hello @Bob','mention_user_ids'=>[2,2]],201)['message'];
    $messageId=(int)$sent['id'];
    $mentions=$admin->query("SELECT id,recipient_id,notification_id FROM message_mentions WHERE message_id=$messageId AND removed_at IS NULL")->fetchAll(PDO::FETCH_ASSOC);
    mention_check(count($mentions)===1 && (int)$mentions[0]['recipient_id']===2,'Duplicate recipient rows were created or recipient missing');
    $mentionId=(int)$mentions[0]['id'];
    $notificationId=(int)$mentions[0]['notification_id'];
    $currentRecipients=mention_request('GET','v1/mentions?action=message&message_id='.$messageId,1);
    mention_check(count($currentRecipients['mention_recipients']??[])===1 && (int)$currentRecipients['mention_recipients'][0]['id']===2,'Message mention recipient lookup did not return the active recipient');
    mention_check($notificationId>0,'Mention did not create notification history');
    $event=$admin->query("SELECT JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.event')) FROM notification_history WHERE id=$notificationId")->fetchColumn();
    mention_check($event==='mention','Notification does not identify the mention event');

    $candidates=mention_request('GET','v1/mentions?action=candidates&chat_id=1&q=Bo',1);
    mention_check(count($candidates['candidates']??[])===1 && (int)$candidates['candidates'][0]['id']===2,'Eligible candidate search failed');
    mention_request('POST','v1/messages',1,['chat_id'=>1,'body'=>'Invalid target','mention_user_ids'=>[4]],422);
    mention_request('POST','v1/messages',1,['chat_id'=>3,'body'=>'Private mention','mention_user_ids'=>[2]],422);

    // Opening a mention marks only its own row and its linked notification read.
    mention_request('POST','v1/mentions',2,['action'=>'open','mention_id'=>$mentionId]);
    $readAt=$admin->query("SELECT read_at FROM message_mentions WHERE id=$mentionId")->fetchColumn();
    mention_check($readAt!==null,'Opening a mention did not mark the mention read');
    mention_check($admin->query("SELECT read_at FROM notification_history WHERE id=$notificationId")->fetchColumn()!==null,'Opening a mention did not mark its notification read');

    // Retained recipients are not notified again; a newly added recipient is.
    $bobMentionNotifications=(int)$admin->query("SELECT COUNT(*) FROM notification_history WHERE user_id=2 AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.event'))='mention'")->fetchColumn();
    mention_request('POST','v1/messages/edit',1,['message_id'=>$messageId,'body'=>'Edited @Bob and @Cara','mention_user_ids'=>[2,3]]);
    $bobMentionNotificationsAfter=(int)$admin->query("SELECT COUNT(*) FROM notification_history WHERE user_id=2 AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.event'))='mention'")->fetchColumn();
    mention_check($bobMentionNotificationsAfter===$bobMentionNotifications,'Retained mention generated a duplicate notification');
    mention_check((int)$admin->query("SELECT COUNT(*) FROM message_mentions WHERE message_id=$messageId AND recipient_id=3 AND removed_at IS NULL")->fetchColumn()===1,'Newly added recipient was not reconciled');

    // Removing a previously read mention deactivates it without erasing read history.
    mention_request('POST','v1/messages/edit',1,['message_id'=>$messageId,'body'=>'Edited @Cara only','mention_user_ids'=>[3]]);
    $bobRow=$admin->query("SELECT read_at,removed_at FROM message_mentions WHERE id=$mentionId")->fetch(PDO::FETCH_ASSOC);
    mention_check($bobRow['read_at']!==null && $bobRow['removed_at']!==null,'Removed mention did not preserve read history and deactivate the entry');

    // Public-room recipients must also be room members; mention notification is queued even without an online device.
    $public=mention_request('POST','v1/messages',1,['chat_id'=>2,'body'=>'Public @Bob','mention_user_ids'=>[2]],201)['message'];
    $publicId=(int)$public['id'];
    mention_check((int)$admin->query("SELECT COUNT(*) FROM message_mentions WHERE message_id=$publicId AND recipient_id=2 AND chat_type='public' AND removed_at IS NULL")->fetchColumn()===1,'Public-room mention was not recorded');
    mention_check((int)$admin->query("SELECT COUNT(*) FROM notification_history WHERE user_id=2 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.message_id')) AS UNSIGNED)=$publicId AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.event'))='mention'")->fetchColumn()===1,'Offline recipient did not receive in-app mention history');
    $publicMention=$admin->query("SELECT id,notification_id FROM message_mentions WHERE message_id=$publicId AND recipient_id=2 AND removed_at IS NULL")->fetch(PDO::FETCH_ASSOC);
    mention_request('POST','v1/notifications/read',2,['notification_ids'=>[(int)$publicMention['notification_id']],'read'=>true]);
    mention_check($admin->query("SELECT read_at FROM message_mentions WHERE id=".(int)$publicMention['id'])->fetchColumn()!==null,'Marking the linked notification read did not synchronize mention state');

    // Message deletion and membership revocation prevent opening old mentions.
    $deleted=mention_request('POST','v1/messages',1,['chat_id'=>1,'body'=>'Delete all @Bob','mention_user_ids'=>[2]],201)['message'];
    $deletedId=(int)$deleted['id'];
    $deletedMention=(int)$admin->query("SELECT id FROM message_mentions WHERE message_id=$deletedId AND recipient_id=2 AND removed_at IS NULL")->fetchColumn();
    mention_request('DELETE','v1/messages?id='.$deletedId.'&scope=everyone',1,null,200);
    mention_check($admin->query("SELECT removed_at FROM message_mentions WHERE id=$deletedMention")->fetchColumn()!==null,'Delete-for-everyone did not deactivate mention');
    mention_request('POST','v1/mentions',2,['action'=>'open','mention_id'=>$deletedMention],404);

    $revoked=mention_request('POST','v1/messages',1,['chat_id'=>1,'body'=>'Revoked @Bob','mention_user_ids'=>[2]],201)['message'];
    $revokedId=(int)$revoked['id'];
    $revokedMention=(int)$admin->query("SELECT id FROM message_mentions WHERE message_id=$revokedId AND recipient_id=2 AND removed_at IS NULL")->fetchColumn();
    $admin->exec("UPDATE chat_members SET status='removed' WHERE chat_id=1 AND user_id=2");
    mention_request('POST','v1/mentions',2,['action'=>'open','mention_id'=>$revokedMention],404);
    $recipientsAfterRevocation=mention_request('GET','v1/mentions?action=message&message_id='.$revokedId,1);
    mention_check(count($recipientsAfterRevocation['mention_recipients']??[])===0,'Revoked member remained selectable in the edit recipient lookup');

    echo " @Mentions integration tests passed.\n";
} finally {
    if (is_resource($process)) proc_terminate($process);
    if (is_dir($root)) {
        $iterator=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $entry) $entry->isDir()?rmdir($entry->getPathname()):unlink($entry->getPathname());
        rmdir($root);
    }
    try { $admin->exec("DROP DATABASE IF EXISTS `$database`"); } catch (Throwable) {}
}
