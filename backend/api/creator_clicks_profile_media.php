<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/media_upload.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') fail('Method not allowed', 405);
$user = auth_user();
$viewerId = (int)$user['id'];
$ownerId = (int)($_GET['user_id'] ?? 0);
$kind = strtolower(trim((string)($_GET['kind'] ?? 'creator')));
if ($ownerId <= 0 || !in_array($kind, ['creator','channel'], true)) fail('Creator picture not found', 404);
$column = $kind === 'channel' ? 'channel_avatar_path' : 'avatar_path';
$stmt = db()->prepare('SELECT ' . $column . ' AS filename FROM creator_clicks_profiles WHERE user_id=? AND channel_deleted_at IS NULL LIMIT 1');
$stmt->execute([$ownerId]);
$filename = basename((string)$stmt->fetchColumn());
if ($filename === '' || !preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/i', $filename)) fail('Creator picture not found', 404);
if ($viewerId !== $ownerId) {
    $blocked = db()->prepare('SELECT 1 FROM creator_clicks_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1');
    $blocked->execute([$viewerId,$ownerId,$ownerId,$viewerId]);
    if ($blocked->fetchColumn()) fail('Creator picture is unavailable', 404);
}
$path = dirname(__DIR__) . '/uploads/creator-clicks/' . $ownerId . '/' . $filename;
if (!is_file($path)) fail('Creator picture is unavailable', 404);
$mime = cloudcomai_detect_mime_type($path);
if (!in_array($mime, ['image/jpeg','image/png','image/webp'], true)) fail('Creator picture type is invalid', 500);
header('Content-Type: ' . $mime);
header('Content-Length: ' . (string)filesize($path));
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
readfile($path);
exit;
