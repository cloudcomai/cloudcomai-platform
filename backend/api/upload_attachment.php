<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);

$chat = (int)($_POST['chat_id'] ?? 0);
$body = trim((string)($_POST['body'] ?? ''));
$reply = (int)($_POST['reply_to_message_id'] ?? 0);
$requestedType = strtolower(trim((string)($_POST['message_type'] ?? 'attachment')));
$policy = strtoupper((string)($_POST['download_policy'] ?? 'APPROVAL_REQUIRED'));
if (!in_array($policy, ['ALLOW','APPROVAL_REQUIRED','VIEW_ONLY'], true)) fail('Invalid download policy');
if ($chat <= 0) fail('Invalid chat');
if (!isset($_FILES['file']) || !is_array($_FILES['file'])) fail('File is required');

$m = db()->prepare('SELECT c.retention_seconds,COALESCE(cus.cleared_through_message_id,0) AS cleared_through_message_id FROM chats c JOIN chat_members cm ON cm.chat_id=c.id LEFT JOIN chat_user_states cus ON cus.chat_id=c.id AND cus.user_id=cm.user_id WHERE c.id=? AND cm.user_id=? AND cm.status="active"');
$m->execute([$chat, $user['id']]);
$row = $m->fetch();
if (!$row) fail('Not a member', 403);
assert_chat_allows_messages($chat, (int)$user['id']);

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('File upload failed');
$maxBytes = 25 * 1024 * 1024;
if ((int)$file['size'] <= 0 || (int)$file['size'] > $maxBytes) fail('File must be between 1 byte and 25 MB');
$originalFilename = trim((string)($_POST['original_filename'] ?? $file['name'] ?? 'attachment'));
$originalFilename = basename(str_replace('\\', '/', $originalFilename));
$originalFilename = preg_replace('/[\x00-\x1F\x7F]/u', '', $originalFilename) ?: 'attachment';
$originalFilename = preg_replace('/^(.{0,255}).*$/us', '$1', $originalFilename) ?: 'attachment';

$allowed = [
 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
 'application/pdf' => 'pdf', 'text/plain' => 'txt',
 'application/msword' => 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
 'application/vnd.ms-excel' => 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
 'application/vnd.ms-powerpoint' => 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
 'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/aac' => 'aac',
 'audio/wav' => 'wav', 'audio/x-wav' => 'wav', 'audio/ogg' => 'ogg', 'audio/webm' => 'webm', 'audio/3gpp' => '3gp',
 'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm', 'video/3gpp' => '3gp'
];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
if (!isset($allowed[$mime])) fail('File type is not allowed');
$messageType = 'attachment';
if ($requestedType === 'voice') {
 $originalExtension = strtolower((string)pathinfo((string)$file['name'], PATHINFO_EXTENSION));
 // libmagic reports audio-only WebM as video/webm on several hosts.
 if (!str_starts_with($mime, 'audio/') && $mime !== 'video/webm' && !($mime === 'video/mp4' && in_array($originalExtension, ['m4a','aac'], true))) fail('Voice messages must contain audio');
 $messageType = 'voice';
} elseif ($requestedType === 'video') {
 if (!str_starts_with($mime, 'video/')) fail('Video messages must contain video');
 $messageType = 'video';
} elseif ($requestedType !== 'attachment') {
 fail('Invalid attachment message type');
}

if ($reply) {
 if ($reply <= (int)$row['cleared_through_message_id']) fail('Invalid reply target');
 $r = db()->prepare('SELECT m.id FROM messages m LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=? WHERE m.id=? AND m.chat_id=? AND m.deleted_for_everyone=0 AND COALESCE(mus.hidden,0)=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())');
 $r->execute([$user['id'], $reply, $chat]);
 if (!$r->fetch()) fail('Invalid reply target');
}

$root = dirname(__DIR__) . '/storage/attachments';
if (!is_dir($root) && !mkdir($root, 0750, true)) fail('Unable to prepare attachment storage', 500);
$stored = bin2hex(random_bytes(24)) . '.' . $allowed[$mime];
$path = $root . '/' . $stored;
if (!move_uploaded_file($file['tmp_name'], $path)) fail('Unable to store attachment', 500);

$expires = $row['retention_seconds'] ? gmdate('Y-m-d H:i:s', time() + (int)$row['retention_seconds']) : null;
$createdAt = gmdate('Y-m-d H:i:s');
$pdo = db();
try {
 $pdo->beginTransaction();
 $st = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,reply_to_message_id,expires_at,created_at) VALUES(?,?,?,?,?,?,?)');
 // Keep body non-null for compatibility with legacy production schemas where messages.body is NOT NULL.
 $st->execute([$chat,$user['id'],$messageType,$body,$reply ?: null,$expires,$createdAt]);
 $messageId = (int)$pdo->lastInsertId();
 $st = $pdo->prepare('INSERT INTO message_attachments(message_id,original_filename,stored_filename,storage_path,mime_type,file_size,download_policy,created_at) VALUES(?,?,?,?,?,?,?,?)');
 $st->execute([$messageId, $originalFilename, $stored, 'storage/attachments/' . $stored, $mime, (int)$file['size'], $policy, $createdAt]);
 $attachmentId = (int)$pdo->lastInsertId();
 $pdo->prepare('UPDATE chat_user_states SET hidden=0,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')->execute([$chat, $user['id']]);
 $pdo->commit();
} catch (Throwable $e) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 @unlink($path);
 error_log('Media message creation failed: ' . $e->getMessage());
 fail('Unable to send media', 500);
}

try {
 create_chat_notifications($chat, (int)$user['id'], (string)$user['name'], $messageType === 'voice' ? 'Voice message' : ($messageType === 'video' ? 'Video message' : ($body !== '' ? $body : 'Sent you an attachment')), $messageId);
} catch (Throwable $e) {
 // A notification problem must not roll back an already stored voice/video/attachment message.
 error_log('Media notification creation failed for message ' . $messageId . ': ' . $e->getMessage());
}

out(['message' => [
 'id' => $messageId, 'chat_id' => $chat, 'sender_id' => (int)$user['id'], 'sender_name' => $user['name'],
 'type' => $messageType, 'body' => $body, 'reply_to_message_id' => $reply ?: null, 'created_at' => $createdAt,
 'attachment' => ['id' => $attachmentId, 'name' => $originalFilename, 'mime_type' => $mime, 'file_size' => (int)$file['size'], 'download_policy' => $policy]
]], 201);
