<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/media_upload.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') fail('Method not allowed', 405);
$user = auth_user();
$userId = (int)$user['id'];
$postId = (int)($_GET['post_id'] ?? 0);
$filename = basename((string)($_GET['file'] ?? ''));
if ($postId <= 0 || $filename === '' || !preg_match('/^[a-f0-9]{32}\.(jpg|png|webp|mp4|mov|webm)$/i', $filename)) fail('Creator Clicks media not found', 404);

$stmt = db()->prepare('SELECT p.creator_id,p.media_manifest FROM creator_clicks_posts p INNER JOIN creator_clicks_profiles c ON c.user_id=p.creator_id AND c.channel_deleted_at IS NULL WHERE p.id=? AND p.deleted_at IS NULL AND p.expires_at>UTC_TIMESTAMP() LIMIT 1');
$stmt->execute([$postId]);
$post = $stmt->fetch();
if (!$post) fail('Creator Clicks post not found or expired', 404);
$creatorId = (int)$post['creator_id'];
if ($creatorId !== $userId) {
    $follow = db()->prepare('SELECT 1 FROM creator_clicks_follows WHERE follower_id=? AND creator_id=? LIMIT 1');
    $follow->execute([$userId, $creatorId]);
    if (!$follow->fetchColumn() || cc_media_blocked($userId, $creatorId)) fail('Follow this creator to view this media', 403);
}
$manifest = json_decode((string)$post['media_manifest'], true);
$files = is_array($manifest) ? ($manifest['files'] ?? []) : [];
$allowed = false;
foreach (is_array($files) ? $files : [] as $item) {
    if (is_array($item) && ($item['filename'] ?? '') === $filename) { $allowed = true; break; }
}
if (!$allowed) fail('Creator Clicks media not found', 404);
$path = dirname(__DIR__) . '/uploads/creator-clicks/' . $creatorId . '/' . $filename;
if (!is_file($path)) fail('Creator Clicks media is unavailable', 404);
$mime = cloudcomai_detect_mime_type($path);
if ($mime === '') fail('Creator Clicks media type could not be determined', 500);
header('Content-Type: ' . $mime);
header('Accept-Ranges: bytes');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
$size = (int)filesize($path);
$start = 0;
$end = max(0, $size - 1);
$status = 200;
$range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
if ($range !== '' && preg_match('/^bytes=(\\d*)-(\\d*)$/', $range, $matches)) {
    if ($matches[1] === '' && $matches[2] !== '') $start = max(0, $size - (int)$matches[2]);
    else {
        $start = (int)$matches[1];
        if ($matches[2] !== '') $end = min($end, (int)$matches[2]);
    }
    if ($start > $end || $start >= $size) {
        http_response_code(416);
        header('Content-Range: bytes */' . $size);
        exit;
    }
    $status = 206;
}
$length = $end - $start + 1;
http_response_code($status);
if ($status === 206) header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
header('Content-Length: ' . $length);
$handle = fopen($path, 'rb');
if ($handle === false) fail('Creator Clicks media could not be opened', 500);
fseek($handle, $start);
$remaining = $length;
while ($remaining > 0 && !feof($handle)) {
    $chunk = fread($handle, min(1024 * 1024, $remaining));
    if ($chunk === false || $chunk === '') break;
    echo $chunk;
    $remaining -= strlen($chunk);
}
fclose($handle);
exit;

function cc_media_blocked(int $viewerId, int $creatorId): bool {
    $stmt = db()->prepare('SELECT 1 FROM creator_clicks_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1');
    $stmt->execute([$viewerId, $creatorId, $creatorId, $viewerId]);
    if ($stmt->fetchColumn()) return true;
    $stmt = db()->prepare('SELECT 1 FROM user_blocks WHERE (user_id=? AND blocked_user_id=?) OR (user_id=? AND blocked_user_id=?) LIMIT 1');
    $stmt->execute([$viewerId, $creatorId, $creatorId, $viewerId]);
    return (bool)$stmt->fetchColumn();
}
