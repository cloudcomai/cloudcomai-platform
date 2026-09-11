<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
$d = input();
$id = (int)($d['attachment_id'] ?? 0);
$type = strtoupper((string)($d['request_type'] ?? 'DOWNLOAD'));
if ($id <= 0 || !in_array($type, ['DOWNLOAD','FORWARD'], true)) fail('Invalid attachment request');
$st = db()->prepare('SELECT a.id,a.message_id,a.download_policy,m.chat_id,m.sender_id FROM message_attachments a JOIN messages m ON m.id=a.message_id WHERE a.id=?');
$st->execute([$id]); $a = $st->fetch();
if (!$a) fail('Attachment not found', 404);
assert_visible_message((int)$a['message_id'], (int)$user['id']);
assert_chat_allows_messages((int)$a['chat_id'], (int)$user['id']);
$member = db()->prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status="active"');
$member->execute([(int)$a['chat_id'], $user['id']]);
if (!$member->fetch()) fail('Not a member', 403);
if ((int)$a['sender_id'] === (int)$user['id'] || $a['download_policy'] === 'ALLOW') out(['status'=>'APPROVED','request_type'=>$type]);
if ($a['download_policy'] === 'VIEW_ONLY') fail('This attachment cannot be saved or forwarded', 403);
$existing = db()->prepare('SELECT id,status FROM attachment_download_requests WHERE attachment_id=? AND requester_id=? AND request_type=? LIMIT 1');
$existing->execute([$id, $user['id'], $type]); $row = $existing->fetch();
if ($row) out(['request_id'=>(int)$row['id'],'status'=>$row['status'],'request_type'=>$type]);
$st = db()->prepare('INSERT INTO attachment_download_requests(attachment_id,requester_id,sender_id,request_type,status,requested_at) VALUES(?,?,?,?,?,?)');
$st->execute([$id,$user['id'],(int)$a['sender_id'],$type,'PENDING',gmdate('Y-m-d H:i:s')]);
$requestId = (int)db()->lastInsertId();
queue_user_notification((int)$a['sender_id'],'attachment','Attachment approval request',($user['name']??'A recipient').' requested '.strtolower($type).' access for an attachment.',[
 'event'=>'attachment_access_request','request_id'=>$requestId,'attachment_id'=>$id,'message_id'=>(int)$a['message_id'],'chat_id'=>(int)$a['chat_id'],'chat_type'=>'private','request_type'=>$type,'requester_id'=>(int)$user['id']
]);
out(['request_id'=>$requestId,'status'=>'PENDING','request_type'=>$type],201);
