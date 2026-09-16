<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed', 405);
$storyId = (int)($_GET['story_id'] ?? 0);
if ($storyId <= 0) fail('Story id is required', 422);
$stmt = db()->prepare('SELECT s.user_id,s.type,s.content,s.audience,s.expires_at FROM stories s WHERE s.id=? AND s.deleted_at IS NULL AND s.expires_at>UTC_TIMESTAMP() LIMIT 1');
$stmt->execute([$storyId]);
$story = $stmt->fetch();
if (!$story) fail('Ring Bell not found or expired', 404);
$ownerId = (int)$story['user_id'];
$allowed = $ownerId === (int)$user['id'] || $story['audience'] === 'public';
if (!$allowed) {
    $friend = db()->prepare('SELECT 1 FROM friend_requests WHERE status="accepted" AND ((requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)) LIMIT 1');
    $friend->execute([(int)$user['id'],$ownerId,$ownerId,(int)$user['id']]);
    $allowed = (bool)$friend->fetch();
}
if (!$allowed) fail('You cannot access this Ring Bell', 403);
$content = json_decode((string)$story['content'], true);
$filename = basename((string)($content['media_filename'] ?? ''));
if ($filename === '') fail('Ring Bell media is unavailable', 404);
$path = dirname(__DIR__) . '/uploads/stories/' . $ownerId . '/' . $filename;
if (!is_file($path)) fail('Ring Bell media is unavailable', 404);
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($path) ?: 'application/octet-stream';
header('Content-Type: ' . $mime);
header('Content-Length: ' . (string)filesize($path));
header('Cache-Control: private, max-age=300');
readfile($path);
exit;
