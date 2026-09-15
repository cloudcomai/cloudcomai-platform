<?php
// Included by the isolated privacy/messaging integration suite.
$backupTables = ['phone_contacts','account_backup_settings','account_backups','account_backup_versions'];
$structures = [];
foreach ($backupTables as $table) {
    $structures[$table] = $admin->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
    $admin->exec("DROP TABLE `$table`");
}
$backupMigration = file_get_contents(__DIR__ . '/../database/migrations/016_account_backup.sql');
$admin->exec($backupMigration); $admin->exec($backupMigration);
foreach ($structures as $table=>$sql) check($admin->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1] === $sql, "Fresh/upgrade backup schema differs: $table");
check((int)$admin->query("SELECT COUNT(*) FROM schema_migrations WHERE version='016_account_backup.sql'")->fetchColumn()===1,'Fresh install did not record backup migration');

$admin->exec("INSERT INTO chats(id,type,name,owner_id) VALUES(201,'group','Backup fixture',1),(202,'group','Removed membership fixture',1)");
$admin->exec("INSERT INTO chat_members(chat_id,user_id,role,status) VALUES(201,1,'owner','active'),(201,2,'member','active'),(202,1,'owner','active'),(202,2,'member','active')");
$first = request('POST','v1/messages',1,['chat_id'=>201,'body'=>'Preserve original sender 😀'],201)['data']['message'];
$hidden = request('POST','v1/messages',1,['chat_id'=>201,'body'=>'Hidden before backup'],201)['data']['message'];
$expired = request('POST','v1/messages',1,['chat_id'=>201,'body'=>'Expired after backup'],201)['data']['message'];
$deleted = request('POST','v1/messages',1,['chat_id'=>201,'body'=>'Deleted after backup'],201)['data']['message'];
$removed = request('POST','v1/messages',1,['chat_id'=>202,'body'=>'Removed membership'],201)['data']['message'];
request('DELETE','v1/messages?id='.$hidden['id'].'&scope=self',2);
$fixtureBytes = ['visible.png'=>'image backup bytes', 'video.mp4'=>'video backup bytes', 'hidden.png'=>'private hidden bytes', 'view-only.png'=>'view only bytes'];
$attachmentIds = [];
foreach ($fixtureBytes as $name=>$contents) {
    file_put_contents($root.'/storage/attachments/'.$name, $contents);
    $messageId = $name==='hidden.png' ? $hidden['id'] : $first['id'];
    $mime = $name==='video.mp4' ? 'video/mp4' : 'image/png';
    $policy = $name==='view-only.png' ? 'VIEW_ONLY' : 'ALLOW';
    $st=$admin->prepare('INSERT INTO message_attachments(message_id,original_filename,stored_filename,storage_path,mime_type,file_size,download_policy) VALUES(?,?,?,?,?,?,?)');
    $st->execute([$messageId,$name,$name,'storage/attachments/'.$name,$mime,strlen($contents),$policy]);
    $attachmentIds[$name]=(int)$admin->lastInsertId();
}
$legacy = request('GET','v1/users/backup',2)['data'];
check($legacy['format']==='cloudcomai-account-backup' && $legacy['version']===1,'Legacy JSON export contract changed');
check(!isset($legacy['profile']['password_hash']), 'Account export leaked credentials');
check(!in_array($attachmentIds['hidden.png'],array_map('intval',array_column($legacy['attachments'],'id')),true),'Hidden attachment leaked into export');
foreach ($legacy['attachments'] as $attachment) check(!isset($attachment['storage_path']) && !isset($attachment['file_data_base64']),'Export leaked file bytes or storage paths');
request('PUT','v1/users/backup',2,['automatic_frequency'=>'daily'],422);
request('POST','v1/users/backup',2,['action'=>'backup'],422);
$admin->exec('UPDATE users SET email_verified=1 WHERE id IN (2,3)');
$status=request('PUT','v1/users/backup',2,['automatic_frequency'=>'daily','include_videos'=>false,'wifi_only'=>true])['data']['backup'];
check($status['automatic_frequency']==='daily' && $status['email_verified'] && $status['configured'],'Verified user could not save backup settings');
request('PUT','v1/users/backup',2,['include_videos'=>'false'],422);
request('PUT','v1/users/backup',2,['automatic_frequency'=>'hourly'],422);
request('POST','v1/users/backup',2,['include_videos'=>'false'],422);
$one=request('POST','v1/users/backup',2,['action'=>'backup'])['data']['backup'];
check($one['version']===1 && $one['restore_available'] && str_ends_with($one['last_backup_at'],'Z'),'Backup metadata is invalid');
require_once $root.'/lib/bootstrap.php';
require_once $root.'/lib/account_backup.php';
$oldPath=$admin->query('SELECT file_path FROM account_backups WHERE user_id=2')->fetchColumn();
$cipher=file_get_contents($oldPath);
check(!str_contains($cipher,'Preserve original sender'), 'Cloud backup is not encrypted');
$snapshot=json_decode(decrypt_backup($cipher,2),true,512,JSON_THROW_ON_ERROR);
$byId=array_column($snapshot['attachments'],null,'id');
check(isset($byId[$attachmentIds['visible.png']]['file_data_base64']),'Image bytes missing from backup');
check(!isset($byId[$attachmentIds['video.mp4']]['file_data_base64']),'Disabled videos included in backup');
check(!isset($byId[$attachmentIds['view-only.png']]['file_data_base64']),'View-only attachment bypassed download policy');
check(!isset($byId[$attachmentIds['hidden.png']]),'Hidden attachment included in cloud backup');
$two=request('POST','v1/users/backup',2,['include_videos'=>true])['data']['backup'];
check($two['version']===2 && !file_exists($oldPath),'New backup did not atomically replace old backup');
$path=$admin->query('SELECT file_path FROM account_backups WHERE user_id=2')->fetchColumn();
$cipher=file_get_contents($path);
check((fileperms($path) & 0777)===0600,'Backup file permissions are not private');
$snapshot=json_decode(decrypt_backup($cipher,2),true,512,JSON_THROW_ON_ERROR);
$byId=array_column($snapshot['attachments'],null,'id');
check(base64_decode($byId[$attachmentIds['video.mp4']]['file_data_base64'],true)===$fixtureBytes['video.mp4'],'Video path/bytes are incorrect');
check(!request('GET','v1/users/backup?status=1&user_id=2',3)['data']['backup']['available'],'Another account can inspect backup metadata');
request('POST','v1/users/backup',3,['action'=>'restore','user_id'=>2],404);
// Old cron headers must not override the authenticated account.
$ownStatus=request('GET','v1/users/backup?status=1',3,null,200,['X-CLOUCOMAI-BACKUP-CRON: integration-test-retired-cron-secret','X-CLOUCOMAI-BACKUP-USER: 2'])['data']['backup'];
check(!$ownStatus['available'],'Cron header bypassed account authentication');
$admin->exec('UPDATE users SET email_verified=0 WHERE id=2');
request('POST','v1/users/backup',2,['action'=>'restore'],422);
$admin->exec('UPDATE users SET email_verified=1 WHERE id=2');
$tampered=$cipher; $tampered[strlen($tampered)-1]=chr(ord($tampered[strlen($tampered)-1])^1);
file_put_contents($path,$tampered);
request('POST','v1/users/backup',2,['action'=>'restore'],422);
file_put_contents($path,$cipher);
$lock=substr('ccai-backup-'.hash('sha256',$database.':2'),0,64);
$lockStmt=$admin->prepare('SELECT GET_LOCK(?,0)'); $lockStmt->execute([$lock]);
try { request('POST','v1/users/backup',2,['action'=>'backup'],409); }
finally { $release=$admin->prepare('SELECT RELEASE_LOCK(?)'); $release->execute([$lock]); }

$admin->exec('UPDATE messages SET expires_at="2000-01-01" WHERE id='.(int)$expired['id']);
$admin->exec('UPDATE messages SET deleted_for_everyone=1 WHERE id='.(int)$deleted['id']);
$admin->exec("UPDATE chat_members SET status='removed' WHERE chat_id=202 AND user_id=2");
// Group history can be hidden per message; simulate the account's cleared-chat
// watermark as well to cover restoring state without changing membership.
request('DELETE','v1/messages?id='.$first['id'].'&scope=self',2);
$admin->exec('INSERT INTO chat_user_states(chat_id,user_id,hidden,cleared_through_message_id,updated_at) SELECT 201,2,1,MAX(id),UTC_TIMESTAMP() FROM messages WHERE chat_id=201 ON DUPLICATE KEY UPDATE hidden=1,cleared_through_message_id=VALUES(cleared_through_message_id)');
unlink($root.'/storage/attachments/visible.png'); unlink($root.'/storage/attachments/video.mp4');
$chatCount=(int)$admin->query('SELECT COUNT(*) FROM chats')->fetchColumn();
$messageCount=(int)$admin->query('SELECT COUNT(*) FROM messages')->fetchColumn();
foreach ([1,2] as $attempt) {
    $restored=request('POST','v1/users/backup',2,['action'=>'restore'])['data']['restore'];
    check($restored['messages']>0 && $restored['skipped_messages']>=3,'Restore ignored removed membership or expired/deleted messages');
    check((int)$admin->query('SELECT COUNT(*) FROM chats')->fetchColumn()===$chatCount,'Restore duplicated chats');
    check((int)$admin->query('SELECT COUNT(*) FROM messages')->fetchColumn()===$messageCount,'Restore duplicated messages');
    check((int)$admin->query('SELECT sender_id FROM messages WHERE id='.(int)$first['id'])->fetchColumn()===1,'Restore changed original sender');
    check($admin->query('SELECT role FROM chat_members WHERE chat_id=201 AND user_id=1')->fetchColumn()==='owner','Restore changed group ownership');
    check($admin->query('SELECT status FROM chat_members WHERE chat_id=202 AND user_id=2')->fetchColumn()==='removed','Restore rejoined a removed member');
    $messages=request('GET','v1/messages?chat_id=201',2)['data']['messages'];
    $ids=array_map('intval',array_column($messages,'id'));
    check(in_array((int)$first['id'],$ids,true) && !in_array((int)$hidden['id'],$ids,true),'Restore exposed an unbacked-up hidden message');
    check(!in_array((int)$expired['id'],$ids,true) && !in_array((int)$deleted['id'],$ids,true),'Restore revived an expired or globally deleted message');
}
check(file_get_contents($root.'/storage/attachments/visible.png')===$fixtureBytes['visible.png'],'Image bytes were not restored');
check(file_get_contents($root.'/storage/attachments/video.mp4')===$fixtureBytes['video.mp4'],'Video bytes were not restored');
$admin->exec("UPDATE account_backups SET last_backup_at='2000-01-01' WHERE user_id=2");
foreach ([1,2] as $attempt) {
    $cron=proc_open([PHP_BINARY,$root.'/cron/account_backups.php'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $output=stream_get_contents($pipes[1]); $errors=stream_get_contents($pipes[2]);
    foreach($pipes as $pipe) fclose($pipe);
    check(proc_close($cron)===0,'Scheduled backup failed: '.$errors);
    check((int)$admin->query('SELECT version FROM account_backups WHERE user_id=2')->fetchColumn()===3,'Scheduler duplicated or missed a due backup');
}
echo "Account backup schema, export privacy, media, ownership, repeat restore, locking and scheduler integration cases passed\n";
