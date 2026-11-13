<?php

declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/media_upload.php';
require_once __DIR__ . '/../lib/story_access.php';

$user = auth_user();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') fail('Method not allowed', 405);
$storyId = (int)($_GET['story_id'] ?? 0);
if ($storyId <= 0) fail('Story id is required', 422);

$stmt = db()->prepare('SELECT s.user_id,s.type,s.content,s.audience,s.expires_at FROM stories s WHERE s.id=? AND s.deleted_at IS NULL AND s.expires_at>UTC_TIMESTAMP() LIMIT 1');
$stmt->execute([$storyId]);
$story = $stmt->fetch();
if (!$story) fail('Ring Bell not found or expired', 404);

$ownerId = (int)$story['user_id'];
if (!can_view_story($storyId, (int)$user['id'])) fail('You cannot access this Moment', 403);

$content = json_decode((string)$story['content'], true);
$filename = basename((string)($content['media_filename'] ?? ''));
if ($filename === '') fail('Ring Bell media is unavailable', 404);
$path = dirname(__DIR__) . '/uploads/stories/' . $ownerId . '/' . $filename;
if (!is_file($path)) fail('Ring Bell media is unavailable', 404);

$mime = cloudcomai_detect_mime_type($path) ?: cloudcomai_media_mime_from_extension($filename);
if ($mime === '') fail('Ring Bell media type could not be determined', 500);

header('Content-Type: ' . $mime);
header('Accept-Ranges: bytes');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
$size = (int)filesize($path);
$start = 0;
$end = max(0, $size - 1);
$status = 200;
$range = trim((string)($_SERVER['HTTP_RANGE'] ?? ''));
if ($range !== '' && preg_match('/^bytes=(\\d*)-(\\d*)$/', $range, $matches)) {
    if ($matches[1] === '' && $matches[2] !== '') {
        $suffix = (int)$matches[2];
        $start = max(0, $size - $suffix);
    } else {
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
if ($handle === false) fail('Moment media could not be opened', 500);
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