<?php
require __DIR__ . '/../lib/bootstrap.php';$user=auth_user();if($_SERVER['REQUEST_METHOD']!=='PATCH'&&$_SERVER['REQUEST_METHOD']!=='POST')fail('Method not allowed',405);
$d=input();$id=(int)($d['message_id']??0);$body=trim((string)($d['body']??''));if(!$id||$body==='')fail('Message and body required');
$st=db()->prepare('UPDATE messages m LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=? SET m.body=?,m.edit_count=1,m.edited_at=UTC_TIMESTAMP() WHERE m.id=? AND m.sender_id=? AND m.id>COALESCE(cus.cleared_through_message_id,0) AND m.edit_count=0 AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) AND m.created_at>UTC_TIMESTAMP()-INTERVAL 15 MINUTE');
$st->execute([$user['id'],$body,$id,$user['id']]);if($st->rowCount()!==1)fail('Message cannot be edited or was already edited',409);out(['message'=>'Message edited once']);
