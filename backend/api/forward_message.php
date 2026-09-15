<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
$input = input();
$messageId = (int)($input['message_id'] ?? 0);
$chatIds = $input['chat_ids'] ?? [];
if ($messageId <= 0) fail('Message id is required', 422);
if (!is_array($chatIds)) fail('chat_ids must be an array', 422);
$chatIds = array_values(array_unique(array_filter(array_map(static fn($id) => (int)$id, $chatIds), static fn($id) => $id > 0)));
if (!$chatIds) fail('Select at least one destination', 422);
if (count($chatIds) > 50) fail('You can forward to at most 50 chats at once', 422);
$sourceStmt = db()->prepare('SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.expires_at,c.type AS chat_type FROM messages m INNER JOIN chats c ON c.id=m.chat_id INNER JOIN chat_members source_member ON source_member.chat_id=m.chat_id AND source_member.user_id=? AND source_member.status="active" LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=? WHERE m.id=? AND m.deleted_for_everyone=0 AND COALESCE(mus.hidden,0)=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) LIMIT 1');
$sourceStmt->execute([$user['id'], $user['id'], $messageId]);
$source = $sourceStmt->fetch();
if (!$source) fail('Message not found or no longer available', 404);
if ($source['type'] !== 'text') fail('Only text messages can be forwarded', 422);
if (trim((string)$source['body']) === '') fail('The selected message is empty', 422);
$pdo = db();
$pdo->beginTransaction();
try {
    $created = [];
    foreach ($chatIds as $chatId) {
        $destination = $pdo->prepare('SELECT c.id,c.type,c.name,c.retention_seconds,cm.status FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? AND cm.status="active" WHERE c.id=? AND c.type IN ("private","group") LIMIT 1');
        $destination->execute([$user['id'], $chatId]);
        $chat = $destination->fetch();
        if (!$chat) fail('One or more selected chats are unavailable', 403);
        assert_chat_allows_messages($chatId, (int)$user['id']);
        $expires = $chat['retention_seconds'] ? gmdate('Y-m-d H:i:s', time() + (int)$chat['retention_seconds']) : null;
        $insert = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,reply_to_message_id,expires_at,created_at) VALUES(?,?,"forwarded_text",?,NULL,?,UTC_TIMESTAMP())');
        $insert->execute([$chatId, $user['id'], $source['body'], $expires]);
        $newId = (int)$pdo->lastInsertId();
        $pdo->prepare('UPDATE chat_user_states SET hidden=0,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')->execute([$chatId, $user['id']]);
        create_chat_notifications($chatId, (int)$user['id'], (string)$user['name'], (string)$source['body'], $newId);
        $created[] = ['id' => $newId, 'chat_id' => $chatId];
    }
    $pdo->commit();
    out(['message_id' => $messageId, 'forwarded' => count($created), 'deliveries' => $created], 201);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($error instanceof RuntimeException) throw $error;
    error_log('Forward message failed: ' . $error->getMessage());
    fail('Unable to forward message', 500);
}
