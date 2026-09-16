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

$thumbnailFilename = null;
$thumbnailPath = null;
$width = isset($_POST['video_width']) ? max(0, (int)$_POST['video_width']) : null;
$height = isset($_POST['video_height']) ? max(0, (int)$_POST['video_height']) : null;
$duration = isset($_POST['video_duration_seconds']) ? max(0, (float)$_POST['video_duration_seconds']) : null;
if ($messageType === 'video') {
    $thumbnailFile = $_FILES['thumbnail'] ?? null;
    if (is_array($thumbnailFile) && ($thumbnailFile['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK && (int)$thumbnailFile['size'] > 0 && (int)$thumbnailFile['size'] <= 2 * 1024 * 1024) {
        $thumbnailMime = (new finfo(FILEINFO_MIME_TYPE))->file($thumbnailFile['tmp_name']);
        if (in_array($thumbnailMime, ['image/jpeg','image/png','image/webp'], true)) {
            $thumbnailFilename = bin2hex(random_bytes(24)) . '.jpg';
            $thumbnailPath = $root . '/' . $thumbnailFilename;
            if (!move_uploaded_file($thumbnailFile['tmp_name'], $thumbnailPath)) { $thumbnailFilename = null; $thumbnailPath = null; }
        }
    }
    if (!$thumbnailPath && function_exists('shell_exec')) {
        $ffmpeg = trim((string)shell_exec('command -v ffmpeg 2>/dev/null'));
        if ($ffmpeg !== '') {
            $thumbnailFilename = bin2hex(random_bytes(24)) . '.jpg';
            $thumbnailPath = $root . '/' . $thumbnailFilename;
            $command = escapeshellarg($ffmpeg) . ' -y -ss 0.1 -i ' . escapeshellarg($path) . ' -frames:v 1 -vf ' . escapeshellarg('scale=min(640,iw):-2') . ' -q:v 5 ' . escapeshellarg($thumbnailPath) . ' 2>/dev/null';
            shell_exec($command);
            if (!is_file($thumbnailPath) || (int)filesize($thumbnailPath) <= 0) { @unlink($thumbnailPath); $thumbnailFilename = null; $thumbnailPath = null; }
        }
    }
    if ($thumbnailPath && (($size = @getimagesize($thumbnailPath)) !== false)) { $thumbnailWidth = (int)$size[0]; $thumbnailHeight = (int)$size[1]; if (!$width) $width = $thumbnailWidth; if (!$height) $height = $thumbnailHeight; }
}

$expires = $row['retention_seconds'] ? gmdate('Y-m-d H:i:s', time() + (int)$row['retention_seconds']) : null;
$createdAt = gmdate('Y-m-d H:i:s');
$defaultBody = $messageType === 'voice' ? 'Voice message' : ($messageType === 'video' ? 'Video message' : 'Attachment');
$messageBody = $body !== '' ? $body : $defaultBody;
$pdo = db();
try {
 $pdo->beginTransaction();
 $st = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,reply_to_message_id,expires_at,created_at) VALUES(?,?,?,?,?,?,?)');
 $st->execute([$chat,$user['id'],$messageType,$messageBody,$reply ?: null,$expires,$createdAt]);
 $messageId = (int)$pdo->lastInsertId();
 $st = $pdo->prepare('INSERT INTO message_attachments(message_id,original_filename,stored_filename,storage_path,thumbnail_filename,thumbnail_path,mime_type,file_size,width,height,duration_seconds,download_policy,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
 $st->execute([$messageId, $originalFilename, $stored, 'storage/attachments/' . $stored, $thumbnailFilename, $thumbnailPath ? 'storage/attachments/' . $thumbnailFilename : null, $mime, (int)$file['size'], $width ?: null, $height ?: null, $duration ?: null, $policy, $createdAt]);
 $attachmentId = (int)$pdo->lastInsertId();
 $pdo->prepare('UPDATE chat_user_states SET hidden=0,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')->execute([$chat, $user['id']]);
 $pdo->commit();
} catch (Throwable $e) {
 if ($pdo->inTransaction()) $pdo->rollBack();
 @unlink($path);
 if ($thumbnailPath) @unlink($thumbnailPath);
 error_log('Media message creation failed: ' . $e->getMessage());
 fail('Unable to send media', 500);
}

try {
 create_chat_notifications($chat, (int)$user['id'], (string)$user['name'], $messageType === 'voice' ? 'Voice message' : ($messageType === 'video' ? 'Video message' : ($body !== '' ? $body : 'Sent you an attachment')), $messageId);
} catch (Throwable $e) {
 error_log('Media notification creation failed for message ' . $messageId . ': ' . $e->getMessage());
}

out(['message' => [
 'id' => $messageId, 'chat_id' => $chat, 'sender_id' => (int)$user['id'], 'sender_name' => $user['name'],
 'type' => $messageType, 'body' => $messageBody, 'reply_to_message_id' => $reply ?: null, 'created_at' => $createdAt,
 'attachment' => ['id' => $attachmentId, 'name' => $originalFilename, 'mime_type' => $mime, 'file_size' => (int)$file['size'], 'thumbnail_available' => (bool)$thumbnailPath, 'width' => $width, 'height' => $height, 'duration_seconds' => $duration, 'download_policy' => $policy]
]], 201);
