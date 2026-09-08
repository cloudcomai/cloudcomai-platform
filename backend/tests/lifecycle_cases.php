<?php
// Included by privacy_messaging_test.php, using its isolated database/server.
$migration=file_get_contents(__DIR__.'/../database/migrations/011_chat_lifecycle_controls.sql');
preg_match_all('/CREATE TABLE IF NOT EXISTS ([a-z_]+)/',$migration,$tableMatches);
$structures=[];
foreach ($tableMatches[1] as $table) {
    $structures[$table]=preg_replace('/ AUTO_INCREMENT=\d+/','',$admin->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1]);
    $admin->exec("DROP TABLE `$table`");
}
$admin->exec($migration); $admin->exec($migration);
foreach ($structures as $table=>$expected) check(preg_replace('/ AUTO_INCREMENT=\d+/','',$admin->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1])===$expected,"Upgrade schema differs from fresh install: $table");

$admin->exec("INSERT INTO chats(id,type,name,owner_id,retention_seconds) VALUES(100,'group','Lifecycle fixture',1,3600)");
$admin->exec("INSERT INTO chat_members(chat_id,user_id,role,status) VALUES(100,1,'owner','active'),(100,2,'member','active')");
request('POST','v1/notifications/device-token',2,['token'=>'ExponentPushToken[lifecycle-only]','platform'=>'ANDROID']);
$send=['chat_id'=>100,'body'=>'Exactly once 😀','client_message_id'=>'integration-retry-123'];
$first=request('POST','v1/messages',1,$send,201)['data']['message'];
$replayed=request('POST','v1/messages',1,$send,201)['data'];
check((int)$first['id']===(int)$replayed['message']['id'] && $replayed['replayed'],'Retry duplicated message');
$changed=$send; $changed['body']='Different payload';
request('POST','v1/messages',1,$changed,409);
$id=(int)$first['id'];
check((int)$admin->query("SELECT COUNT(*) FROM notification_history WHERE JSON_EXTRACT(data_json,'$.message_id')=$id")->fetchColumn()===1,'Retry duplicated notification');
$own=request('GET','v1/messages?chat_id=100',1)['data']['messages'][0];
$other=request('GET','v1/messages?chat_id=100',2)['data']['messages'][0];
check($own['client_message_id']===$send['client_message_id'] && $other['client_message_id']===null,'Client retry key not isolated by account');
request('POST','v1/messages/saved',2,['message_id'=>$id]);
request('POST','v1/messages/saved',2,['message_id'=>$id]);
request('POST','v1/messages/saved',3,['message_id'=>$id],404);
check(count(request('GET','v1/messages/saved',2)['data']['messages'])===1,'Bookmark duplicated or missing');
check(count(request('GET','v1/messages/saved',1)['data']['messages'])===0,'Bookmark leaked to another user');

$newer=request('POST','v1/messages',1,['chat_id'=>100,'body'=>'Unread after watermark'],201)['data']['message'];
$newerId=(int)$newer['id'];
$receipt=request('POST','v1/notifications/chat-state',2,['chat_id'=>100,'mark_read'=>true,'last_read_message_id'=>$id])['data'];
check($receipt['unread_messages_count']===1,'Read receipt consumed a later unseen message');
request('POST','v1/notifications/chat-state',2,['chat_id'=>100,'mark_read'=>true,'last_read_message_id'=>1]);
check((int)$admin->query('SELECT last_read_message_id FROM chat_user_states WHERE chat_id=100 AND user_id=2')->fetchColumn()===$id,'Read watermark moved backwards');
request('POST','v1/notifications/chat-state',3,['chat_id'=>100,'mark_read'=>true],404);
request('POST','v1/notifications/chat-state',2,['chat_id'=>100,'muted'=>'false'],422);
$inbox=request('GET','v1/notifications',2)['data'];
$notification=array_values(array_filter($inbox['notifications'],fn($n)=>(int)($n['data']['message_id']??0)===$newerId))[0];
$notificationId=(int)$notification['id'];
request('POST','v1/notifications/read',3,['notification_ids'=>[$notificationId]]);
check($admin->query("SELECT read_at FROM notification_history WHERE id=$notificationId")->fetchColumn()===null,'Another user marked notification read');
$read=request('POST','v1/notifications/read',2,['notification_ids'=>[$notificationId]])['data'];
check($read['unread_count']===request('GET','v1/notifications',2)['data']['unread_count'],'Badge not authoritative');
request('POST','v1/notifications/read',2,['notification_ids'=>[$notificationId],'read'=>false]);
check($admin->query("SELECT read_at FROM notification_history WHERE id=$notificationId")->fetchColumn()===null,'Mark unread failed');
check((int)$admin->query("SELECT COUNT(*) FROM notification_delivery_queue WHERE notification_id=$notificationId AND status='PENDING'")->fetchColumn()===0,'Mark unread requeued push');

request('PUT','v1/notifications/preferences',2,['group'=>false]);
$disabled=request('POST','v1/messages',1,['chat_id'=>100,'body'=>'Inbox without push'],201)['data']['message'];
$disabledId=(int)$disabled['id'];
check((int)$admin->query("SELECT COUNT(*) FROM notification_history WHERE JSON_EXTRACT(data_json,'$.message_id')=$disabledId")->fetchColumn()===1,'Disabling push removed inbox history');
check((int)$admin->query("SELECT COUNT(*) FROM notification_delivery_queue q JOIN notification_history h ON h.id=q.notification_id WHERE JSON_EXTRACT(h.data_json,'$.message_id')=$disabledId")->fetchColumn()===0,'Push opt-out ignored');
request('PUT','v1/notifications/preferences',2,['group'=>true]);
// A registered token changing accounts must never receive the old account's queue.
request('POST','v1/notifications/device-token',3,['token'=>'ExponentPushToken[lifecycle-only]','platform'=>'ANDROID']);
check((int)$admin->query("SELECT COUNT(*) FROM notification_delivery_queue q JOIN notification_devices d ON d.id=q.device_id JOIN notification_history h ON h.id=q.notification_id WHERE d.user_id<>h.user_id")->fetchColumn()===0,'Device reassignment retained another account push');

$poll=request('POST','v1/polls',1,['chat_id'=>100,'question'=>'Default expiry','options'=>['Yes','No']],201)['data']['message'];
$pollId=(int)$poll['poll_id']; $pollMessageId=(int)$poll['id'];
$seconds=(int)$admin->query("SELECT TIMESTAMPDIFF(SECOND,created_at,closes_at) FROM polls WHERE id=$pollId")->fetchColumn();
check(abs($seconds-30*86400)<=2,'Poll does not default to 30 days');
check($poll['expires_at']===$poll['poll']['expires_at'],'Poll and message expiration disagree');
$custom=gmdate('Y-m-d\TH:i:s\Z',time()+86400*2);
$customPoll=request('POST','v1/polls',1,['chat_id'=>100,'question'=>'Custom expiry','options'=>['Yes','No'],'expires_at'=>$custom],201)['data']['message'];
check($customPoll['expires_at']===gmdate('Y-m-d H:i:s',strtotime($custom)),'Chosen poll expiry ignored');
request('POST','v1/polls',1,['chat_id'=>100,'question'=>'Invalid expiry','options'=>['Yes','No'],'expires_at'=>'2000-01-01T00:00:00Z'],422);

$admin->exec("UPDATE messages SET expires_at='2000-01-01' WHERE id IN ($id,$pollMessageId)");
$admin->exec("UPDATE polls SET closes_at='2000-01-01' WHERE id=$pollId");
$attachmentPath='storage/attachments/lifecycle-fixture.txt';
if (!is_dir($root.'/storage/attachments')) mkdir($root.'/storage/attachments',0700,true);
file_put_contents($root.'/'.$attachmentPath,'expired media');
$admin->exec("INSERT INTO message_attachments(message_id,original_filename,stored_filename,storage_path,mime_type,file_size,download_policy) VALUES($id,'fixture.txt','lifecycle-fixture.txt','$attachmentPath','text/plain',13,'ALLOW')");
require_once $root.'/lib/bootstrap.php';
require_once $root.'/lib/retention.php';
$counts=cleanup_expired_content($admin,$root,2);
check($counts['messages']>=2 && !file_exists($root.'/'.$attachmentPath),'Cleanup retained expired bytes');
check((int)$admin->query("SELECT COUNT(*) FROM polls WHERE id=$pollId")->fetchColumn()===0,'Cleanup retained poll');
check((int)$admin->query("SELECT COUNT(*) FROM saved_messages WHERE message_id=$id")->fetchColumn()===0,'Cleanup retained expired bookmark');
check((int)$admin->query("SELECT COUNT(*) FROM message_attachments WHERE message_id=$id")->fetchColumn()===0,'Cleanup retained attachment metadata');
$sync=request('GET','v1/messages?chat_id=100&after_id='.$pollMessageId,2)['data'];
check(in_array($pollMessageId,$sync['removed_ids'],true) && in_array($id,$sync['removed_ids'],true),'Purged messages were not removed by incremental sync');
check(cleanup_expired_content($admin,$root)['messages']===0,'Second cleanup is not idempotent');
request('POST','v1/messages',1,$send,409);
$outside=$root.'/outside.txt'; file_put_contents($outside,'keep');
$admin->exec("INSERT INTO file_cleanup_queue(storage_path) VALUES('../outside.txt')");
check(cleanup_expired_content($admin,$root)['file_failures']===1 && file_exists($outside),'Cleanup allowed unsafe file deletion');
$admin->exec("DELETE FROM file_cleanup_queue WHERE storage_path='../outside.txt'");

request('POST','v1/groups?action=transfer&id=100',2,['user_id'=>1],403);
request('POST','v1/groups?action=transfer&id=100',1,['user_id'=>3],422);
request('POST','v1/groups?action=transfer&id=100',1,['user_id'=>2]);
check((int)$admin->query('SELECT owner_id FROM chats WHERE id=100')->fetchColumn()===2,'Ownership did not transfer');
check($admin->query('SELECT role FROM chat_members WHERE chat_id=100 AND user_id=1')->fetchColumn()==='admin','Previous owner should become admin');
check((int)$admin->query('SELECT COUNT(*) FROM group_role_events WHERE chat_id=100')->fetchColumn()===1,'Ownership event missing');
request('POST','v1/groups?action=transfer&id=100',1,['user_id'=>2],403);

// Exercise revocation using actual bearer tokens, including old stateless tokens.
function session_request(string $method,string $path,string $token,?array $body=null,int $expected=200): array {
    $context=stream_context_create(['http'=>['method'=>$method,'header'=>"Authorization: Bearer $token\r\nContent-Type: application/json",'content'=>$body ? json_encode($body) : '', 'ignore_errors'=>true]]);
    $raw=file_get_contents('http://127.0.0.1:18765/'.$path,false,$context);
    preg_match('/\s(\d{3})\s/',$http_response_header[0] ?? '',$match);
    check((int)($match[1] ?? 0)===$expected,"Unexpected session API status for $method $path");
    return json_decode($raw,true) ?: [];
}
$token=token_for(2);
$sessions=session_request('GET','v1/users/sessions',$token)['sessions'];
$current=array_values(array_filter($sessions,fn($s)=>$s['current']))[0];
check(!isset($current['token_hash']) && !isset($current['token']),'Session API exposed credentials');
session_request('DELETE','v1/users/sessions?id='.$current['id'],$token);
session_request('GET','v1/users/sessions',$token,null,401);
$token=token_for(2);
$rotated=session_request('POST','v1/users/sessions',$token,['revoke_others'=>true]);
session_request('GET','v1/users/sessions',$token,null,401);
session_request('GET','v1/users/sessions',test_token(2),null,401);
$remaining=session_request('GET','v1/users/sessions',$rotated['token'])['sessions'];
check(count($remaining)===1 && $remaining[0]['current'],'Revoke others did not preserve only the renewed current session');
echo "Lifecycle, notification, privacy, retry, saved message, ownership and session cases passed\n";
