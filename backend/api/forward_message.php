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
assert_visible_message($messageId, (int)$user['id']);
$sourceStmt = db()->prepare('SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.expires_at,c.type AS chat_type,ma.id AS attachment_id,ma.original_filename,ma.stored_filename,ma.storage_path,ma.thumbnail_filename,ma.thumbnail_path,ma.mime_type,ma.file_size,ma.width,ma.height,ma.duration_seconds,ma.download_policy FROM messages m INNER JOIN chats c ON c.id=m.chat_id INNER JOIN chat_members source_member ON source_member.chat_id=m.chat_id AND source_member.user_id=? AND source_member.status="active" LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=? LEFT JOIN message_attachments ma ON ma.message_id=m.id WHERE m.id=? AND m.deleted_for_everyone=0 AND COALESCE(mus.hidden,0)=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) LIMIT 1');
$sourceStmt->execute([$user['id'], $user['id'], $messageId]);
$source = $sourceStmt->fetch();
if (!$source) fail('Message not found or no longer available', 404);
$hasAttachment = !empty($source['attachment_id']);
if (!$hasAttachment && !in_array($source['type'], ['text', 'forwarded_text'], true)) fail('This message type cannot be forwarded', 422);
if (!$hasAttachment && trim((string)$source['body']) === '') fail('The selected message is empty', 422);
if ($hasAttachment && (int)$source['sender_id'] !== (int)$user['id'] && $source['download_policy'] !== 'ALLOW' && !is_trusted_user((int)$source['sender_id'], (int)$user['id'])) {
    $approval = $pdo ?? db();
    $approvalStmt = $approval->prepare('SELECT 1 FROM attachment_download_requests WHERE attachment_id=? AND requester_id=? AND status="APPROVED" LIMIT 1');
    $approvalStmt->execute([(int)$source['attachment_id'], (int)$user['id']]);
    if (!$approvalStmt->fetch()) fail('Forward requires sender approval', 403);
}
$pdo = db();
$pdo->beginTransaction();
try {
    $created = [];
    foreach ($chatIds as $chatId) {
        $destination = $pdo->prepare('SELECT c.id,c.type,c.name,c.retention_seconds,cm.status FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? AND cm.status="active" AND cm.role<>"readonly" WHERE c.id=? AND c.type IN ("private","group") LIMIT 1');
        $destination->execute([$user['id'], $chatId]);
        $chat = $destination->fetch();
        if (!$chat) fail('One or more selected chats are unavailable', 403);
        assert_chat_allows_messages($chatId, (int)$user['id']);
        $expires = $chat['retention_seconds'] ? gmdate('Y-m-d H:i:s', time() + (int)$chat['retention_seconds']) : null;
        $forwardedType = $hasAttachment ? (string)$source['type'] : 'forwarded_text';
        $insert = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,reply_to_message_id,expires_at,created_at) VALUES(?,?,?,?,NULL,?,UTC_TIMESTAMP())');
        $insert->execute([$chatId, $user['id'], $forwardedType, $source['body'], $expires]);
        $newId = (int)$pdo->lastInsertId();
        if ($hasAttachment) {
            $storageRoot = dirname(__DIR__) . '/storage/attachments';
            $sourcePath = $storageRoot . '/' . basename((string)$source['stored_filename']);
            if (!is_file($sourcePath) || !is_readable($sourcePath)) throw new RuntimeException('Source attachment file is unavailable');
            if (!is_dir($storageRoot) || !is_writable($storageRoot)) throw new RuntimeException('Attachment storage is not writable');
            $forwardedStoredName = bin2hex(random_bytes(24)) . '.' . pathinfo((string)$source['stored_filename'], PATHINFO_EXTENSION);
            $forwardPath = $storageRoot . '/' . $forwardedStoredName;
            if (!copy($sourcePath, $forwardPath)) throw new RuntimeException('Unable to copy forwarded attachment');
            $forwardedThumbnailName = null;
            $forwardedThumbnailPath = null;
            if (!empty($source['thumbnail_filename'])) {
                $sourceThumbnailPath = $storageRoot . '/' . basename((string)$source['thumbnail_filename']);
                if (is_file($sourceThumbnailPath) && is_readable($sourceThumbnailPath)) {
                    $forwardedThumbnailName = bin2hex(random_bytes(24)) . '.jpg';
                    $forwardedThumbnailAbsolutePath = $storageRoot . '/' . $forwardedThumbnailName;
                    if (copy($sourceThumbnailPath, $forwardedThumbnailAbsolutePath)) $forwardedThumbnailPath = 'storage/attachments/' . $forwardedThumbnailName;
                    else $forwardedThumbnailName = null;
                }
            }
            $copyAttachment = $pdo->prepare('INSERT INTO message_attachments(message_id,original_filename,stored_filename,storage_path,thumbnail_filename,thumbnail_path,mime_type,file_size,width,height,duration_seconds,download_policy,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())');
            $copyAttachment->execute([$newId, $source['original_filename'], $forwardedStoredName, 'storage/attachments/' . $forwardedStoredName, $forwardedThumbnailName, $forwardedThumbnailPath, $source['mime_type'], $source['file_size'], $source['width'], $source['height'], $source['duration_seconds'], $source['download_policy']]);
        }
        $pdo->prepare('UPDATE chat_user_states SET hidden=0,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')->execute([$chatId, $user['id']]);
        create_chat_notifications($chatId, (int)$user['id'], (string)$user['name'], (string)$source['body'], $newId);
        $created[] = ['id' => $newId, 'chat_id' => $chatId];
    }
    $pdo->commit();
    out(['message_id' => $messageId, 'forwarded' => count($created), 'deliveries' => $created], 201);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Forward message failed: ' . $error->getMessage());
    fail('Unable to forward message', 500);
}
