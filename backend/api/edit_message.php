<?php
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/mentions.php';

$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH' && $_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);

$data = input();
$id = (int)($data['message_id'] ?? $data['editing_id'] ?? 0);
$body = trim((string)($data['body'] ?? ''));
if (!$id || $body === '') fail('Message and body required');
$mentionIds = array_key_exists('mention_user_ids', $data) ? normalize_mention_user_ids($data['mention_user_ids']) : null;

$chatQuery = db()->prepare('SELECT m.chat_id,c.type AS chat_type FROM messages m INNER JOIN chats c ON c.id=m.chat_id WHERE m.id=? AND m.sender_id=? LIMIT 1');
$chatQuery->execute([$id, $user['id']]);
$chat = $chatQuery->fetch();
$chatId = (int)($chat['chat_id'] ?? 0);
if ($chatId <= 0) fail('Message cannot be edited', 404);

assert_chat_allows_messages($chatId, (int)$user['id']);
assert_visible_message($id, (int)$user['id']);
$typeQuery = db()->prepare('SELECT type FROM messages WHERE id=?');
$typeQuery->execute([$id]);
if ($typeQuery->fetchColumn() !== 'text') fail('Only text messages can be edited', 409);
if ($mentionIds && !in_array($chat['chat_type'], ['group', 'public'], true)) fail('@Mentions are available only in group chats and public rooms', 422);

$pdo = db();
try {
    $pdo->beginTransaction();
    // Serialize edits and mention reconciliation on the message row.
    $lock = $pdo->prepare('SELECT id FROM messages WHERE id=? AND sender_id=? FOR UPDATE');
    $lock->execute([$id, $user['id']]);
    if (!$lock->fetch()) { $pdo->rollBack(); fail('Message cannot be edited', 404); }

    // The edit policy is enforced atomically in the UPDATE so concurrent requests
    // cannot consume more than the two available edits. created_at is deliberately
    // used for the three-hour window; edited_at never extends that window.
    $update = $pdo->prepare(
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
    if ($update->rowCount() !== 1) {
        $pdo->rollBack();
        fail('Message cannot be edited, the 3-hour window has expired, or the edit limit has been reached', 409);
    }

    // Older clients omit mention_user_ids: preserve current mentions for them.
    // New clients send the full selected ID set so only newly added IDs notify.
    if ($mentionIds !== null) reconcile_message_mentions($id, $chatId, (int)$user['id'], $mentionIds);

    $updated = $pdo->prepare(
        'SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.reply_to_message_id,m.edit_count,m.edited_at,m.created_at,m.expires_at,u.name AS sender_name
         FROM messages m INNER JOIN users u ON u.id=m.sender_id WHERE m.id=?'
    );
    $updated->execute([$id]);
    $message = $updated->fetch();
    $pdo->commit();
    out(['message' => $message]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Message edit failed: ' . $error->getMessage());
    fail('Unable to edit message', 500);
}
