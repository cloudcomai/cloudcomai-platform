<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH' && $_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);

$data = input();
$id = (int)($data['message_id'] ?? $data['editing_id'] ?? 0);
$body = trim((string)($data['body'] ?? ''));
if (!$id || $body === '') fail('Message and body required');

$chatQuery = db()->prepare('SELECT chat_id FROM messages WHERE id=? AND sender_id=? LIMIT 1');
$chatQuery->execute([$id, $user['id']]);
$chatId = (int)($chatQuery->fetchColumn() ?: 0);
if ($chatId <= 0) fail('Message cannot be edited', 404);

assert_chat_allows_messages($chatId, (int)$user['id']);
assert_visible_message($id, (int)$user['id']);

$typeQuery = db()->prepare('SELECT type FROM messages WHERE id=?');
$typeQuery->execute([$id]);
if ($typeQuery->fetchColumn() !== 'text') fail('Only text messages can be edited', 409);

// The edit policy is enforced atomically in the UPDATE so concurrent requests
// cannot consume more than the two available edits. created_at is deliberately
// used for the three-hour window; edited_at never extends that window.
$update = db()->prepare(
    'UPDATE messages m
     LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=?
     SET m.body=?, m.edit_count=m.edit_count+1, m.edited_at=UTC_TIMESTAMP()
     WHERE m.id=?
       AND m.sender_id=?
       AND m.id>COALESCE(cus.cleared_through_message_id,0)
       AND m.edit_count<2
       AND m.deleted_for_everyone=0
       AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())
       AND m.created_at>=UTC_TIMESTAMP()-INTERVAL 3 HOUR'
);
$update->execute([$user['id'], $body, $id, $user['id']]);

if ($update->rowCount() !== 1) fail('Message cannot be edited, the 3-hour window has expired, or the edit limit has been reached', 409);

$updated = db()->prepare(
    'SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.reply_to_message_id,m.edit_count,m.edited_at,m.created_at,m.expires_at,u.name AS sender_name
     FROM messages m
     INNER JOIN users u ON u.id=m.sender_id
     WHERE m.id=?'
);
$updated->execute([$id]);
$message = $updated->fetch();

out(['message' => $message]);
