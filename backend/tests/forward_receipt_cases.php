<?php
// Included by the isolated privacy/messaging suite before session revocation.
$receiptSchema=$admin->query('SHOW CREATE TABLE message_read_receipts')->fetch(PDO::FETCH_NUM)[1];
$admin->exec('DROP TABLE message_read_receipts');
$receiptMigration=file_get_contents(__DIR__.'/../database/migrations/017_message_read_receipts.sql');
$admin->exec($receiptMigration); $admin->exec($receiptMigration);
check($admin->query('SHOW CREATE TABLE message_read_receipts')->fetch(PDO::FETCH_NUM)[1]===$receiptSchema,'Fresh and upgrade receipt schemas differ');
check((int)$admin->query("SELECT COUNT(*) FROM schema_migrations WHERE version='017_message_read_receipts.sql'")->fetchColumn()===1,'Fresh receipt migration marker missing');
$admin->exec("INSERT INTO chats(id,type,name,owner_id,retention_seconds) VALUES(301,'private','Forward source',1,3600),(302,'group','Forward destination',1,7200)");
$admin->exec("INSERT INTO chat_members(chat_id,user_id,role,status) VALUES(301,1,'member','active'),(301,2,'member','active'),(302,1,'owner','active'),(302,2,'member','active'),(302,3,'member','active')");
$source=request('POST','v1/messages',1,['chat_id'=>301,'body'=>'Forward this 😀'],201)['data']['message'];
$receiptPath='v1/messages/read?message_id='.$source['id'];
check(!request('GET',$receiptPath,1)['data']['read'],'New message was already read');
check(request('POST','v1/messages/read',3,['message_ids'=>[$source['id']]])['data']['message_ids']===[],'Nonmember marked a receipt');
request('GET',$receiptPath,3,null,404);
check(request('POST','v1/messages/read',1,['message_ids'=>[$source['id']]])['data']['message_ids']===[],'Sender marked own message read');
request('POST','v1/messages/read',2,['message_ids'=>[$source['id']]]);
$read=request('GET',$receiptPath,1)['data'];
check($read['read'] && $read['is_sender'] && array_column($read['read_by'],'user_id')===[2],'Private receipt did not identify reader');
$admin->exec("UPDATE message_read_receipts SET read_at='2000-01-01' WHERE message_id=".(int)$source['id']);
request('POST','v1/messages/read',2,['message_ids'=>[$source['id']]]);
check(str_starts_with(request('GET',$receiptPath,1)['data']['read_by'][0]['read_at'],'2000-01-01'),'Repeated receipt replaced first read time');

$forward=request('POST','v1/messages/forward',2,['message_id'=>$source['id'],'chat_ids'=>[302,302]],201)['data'];
check($forward['forwarded']===1,'Duplicate forward destinations were not deduplicated');
$forwardId=(int)$forward['deliveries'][0]['id'];
$row=$admin->query('SELECT sender_id,type,body,TIMESTAMPDIFF(SECOND,created_at,expires_at) AS lifetime FROM messages WHERE id='.$forwardId)->fetch(PDO::FETCH_ASSOC);
check((int)$row['sender_id']===2 && $row['type']==='forwarded_text' && $row['body']===$source['body'] && (int)$row['lifetime']===7200,'Forwarded content, sender or retention is incorrect');
request('POST','v1/messages/forward',2,['message_id'=>$forwardId,'chat_ids'=>[301]],201);
request('POST','v1/messages/read',1,['message_ids'=>[$forwardId]]);
request('POST','v1/messages/read',3,['message_ids'=>[$forwardId]]);
check(count(request('GET','v1/messages/read?message_id='.$forwardId,2)['data']['read_by'])===2,'Group receipt lost readers');
$location=request('POST','v1/messages',1,['chat_id'=>302,'type'=>'location','latitude'=>0,'longitude'=>0],201)['data']['message'];
request('POST','v1/messages/read',2,['message_ids'=>[$location['id']]]);
check(request('GET','v1/messages/read?message_id='.$location['id'],1)['data']['read'],'Nontext message has no receipt');
request('POST','v1/messages/forward',2,['message_id'=>$location['id'],'chat_ids'=>[301]],422);

$before=(int)$admin->query('SELECT COUNT(*) FROM messages')->fetchColumn();
request('POST','v1/messages/forward',2,['message_id'=>$source['id'],'chat_ids'=>[302,999999]],403);
check((int)$admin->query('SELECT COUNT(*) FROM messages')->fetchColumn()===$before,'Rejected multi-destination forward partially committed');
$admin->exec("UPDATE chat_members SET role='readonly' WHERE chat_id=302 AND user_id=2");
request('POST','v1/messages/forward',2,['message_id'=>$source['id'],'chat_ids'=>[302]],403);
$admin->exec("UPDATE chat_members SET role='member' WHERE chat_id=302 AND user_id=2");
$admin->exec('INSERT INTO user_blocks(user_id,blocked_user_id) VALUES(1,2)');
request('POST','v1/messages/forward',2,['message_id'=>$forwardId,'chat_ids'=>[301]],403);
$admin->exec('DELETE FROM user_blocks WHERE user_id=1 AND blocked_user_id=2');
request('POST','v1/messages/forward',3,['message_id'=>$source['id'],'chat_ids'=>[302]],404);
request('POST','v1/messages/forward',1,['message_id'=>$source['id'],'chat_ids'=>[2500]],403);
check(!request('GET','v1/messages/read?message_id='.$publicMessage['id'],1)['data']['eligible'],'Public message exposes read receipts');
check(request('POST','v1/messages/read',1,['message_ids'=>[$publicMessage['id']]])['data']['message_ids']===[],'Public receipt was recorded');

request('DELETE','v1/messages?id='.$source['id'].'&scope=self',2);
request('GET',$receiptPath,2,null,404);
check(request('POST','v1/messages/read',2,['message_ids'=>[$source['id']]])['data']['message_ids']===[],'Hidden message marked read');
request('POST','v1/messages/forward',2,['message_id'=>$source['id'],'chat_ids'=>[302]],404);
$admin->exec('DELETE FROM message_user_states WHERE user_id=2 AND message_id='.(int)$source['id']);
request('DELETE','v1/chats?id=301',2);
request('GET',$receiptPath,2,null,404);
request('POST','v1/messages/forward',2,['message_id'=>$source['id'],'chat_ids'=>[302]],404);
check(request('POST','v1/messages/read',2,['message_ids'=>[$source['id']]])['data']['message_ids']===[],'Cleared chat marked read');
$admin->exec('UPDATE chat_user_states SET hidden=0,cleared_through_message_id=0 WHERE chat_id=301 AND user_id=2');
foreach (["expires_at='2000-01-01'",'expires_at=NULL,deleted_for_everyone=1'] as $change) {
    $admin->exec('UPDATE messages SET '.$change.' WHERE id='.(int)$source['id']);
    request('GET',$receiptPath,2,null,404);
    request('POST','v1/messages/forward',2,['message_id'=>$source['id'],'chat_ids'=>[302]],404);
    check(request('POST','v1/messages/read',2,['message_ids'=>[$source['id']]])['data']['message_ids']===[],'Unavailable message marked read');
}
echo "Forwarding authorization, atomicity, retention, receipt visibility and migration integration cases passed\n";
