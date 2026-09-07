<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$id = (int)($_GET['id'] ?? 0);
$preview = ($_GET['preview'] ?? '') === '1';
if ($id <= 0) fail('Invalid attachment', 400);

$st = db()->prepare('SELECT a.*,m.chat_id,m.sender_id,c.type AS chat_type FROM message_attachments a JOIN messages m ON m.id=a.message_id AND m.deleted_for_everyone=0 JOIN chats c ON c.id=m.chat_id WHERE a.id=?');
$st->execute([$id]);
$a = $st->fetch();
if (!$a) fail('Attachment not found', 404);
assert_visible_message((int)$a['message_id'], (int)$user['id']);

$member = db()->prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status="active"');
$member->execute([(int)$a['chat_id'], $user['id']]);
if (!$member->fetch()) fail('Not a member', 403);

$cleared = db()->prepare('SELECT cleared_through_message_id FROM chat_user_states WHERE chat_id=? AND user_id=? LIMIT 1');
$cleared->execute([(int)$a['chat_id'], $user['id']]);
$clearedThrough = (int)($cleared->fetchColumn() ?: 0);
if ((int)$a['message_id'] <= $clearedThrough) fail('Attachment not found', 404);

$isImage = str_starts_with((string)$a['mime_type'], 'image/');
$isAudio = str_starts_with((string)$a['mime_type'], 'audio/');
$isVideo = str_starts_with((string)$a['mime_type'], 'video/');
if ($preview) {
    if (!$isImage && !$isAudio && !$isVideo) fail('Preview is not available for this file type', 400);
    // Inline media may be viewed by chat members, while the original download
    // remains protected by the sender's download policy.
    $authorizedPreview = true;
} else {
    $authorizedPreview = (int)$a['sender_id'] === (int)$user['id'] || $a['download_policy'] === 'ALLOW';
    if (!$authorizedPreview && $a['download_policy'] === 'APPROVAL_REQUIRED') {
        $q = db()->prepare('SELECT 1 FROM attachment_download_requests WHERE attachment_id=? AND requester_id=? AND status="APPROVED"');
        $q->execute([$id, $user['id']]);
        $authorizedPreview = (bool)$q->fetch();
    }
}
if (!$authorizedPreview) fail($a['download_policy'] === 'VIEW_ONLY' ? 'Download is disabled for this attachment' : 'Download requires sender approval', 403);

$root = dirname(__DIR__);
$path = $root . '/' . ltrim($a['storage_path'], '/');
if (!is_file($path)) fail('Attachment file not found', 404);

header('Content-Type: ' . $a['mime_type']);
header('Cache-Control: private, no-store');
header('Content-Disposition: ' . ($preview ? 'inline' : 'attachment') . '; filename="' . addcslashes(basename($a['original_filename']), '"\\') . '"');
header('X-Content-Type-Options: nosniff');
$size = filesize($path);
$start = 0;
$end = $size - 1;
header('Accept-Ranges: bytes');
if (isset($_SERVER['HTTP_RANGE'])) {
    if (!preg_match('/^bytes=(\d*)-(\d*)$/', trim($_SERVER['HTTP_RANGE']), $range) || ($range[1] === '' && $range[2] === '')) {
        header('Content-Range: bytes */' . $size);
        http_response_code(416);
        exit;
    }
    if ($range[1] === '') $start = max(0, $size - (int)$range[2]);
    else {
        $start = (int)$range[1];
        if ($range[2] !== '') $end = min($end, (int)$range[2]);
    }
    if ($start > $end || $start >= $size) {
        header('Content-Range: bytes */' . $size);
        http_response_code(416);
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$size");
}
$remaining = $end - $start + 1;
header('Content-Length: ' . $remaining);
$handle = fopen($path, 'rb');
fseek($handle, $start);
while ($remaining > 0 && !feof($handle) && !connection_aborted()) {
    $chunk = fread($handle, min(65536, $remaining));
    if ($chunk === false || $chunk === '') break;
    echo $chunk;
    $remaining -= strlen($chunk);
}
fclose($handle);
exit;
