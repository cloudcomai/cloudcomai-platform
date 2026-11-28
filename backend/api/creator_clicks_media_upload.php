<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/media_upload.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Method not allowed', 405);
$user = auth_user();
$userId = (int)$user['id'];
$profile = db()->prepare('SELECT user_id FROM creator_clicks_profiles WHERE user_id=? AND channel_deleted_at IS NULL LIMIT 1');
$profile->execute([$userId]);
if (!$profile->fetchColumn()) fail('Create an active Creator Clicks channel before uploading media', 409);

$file = $_FILES['file'] ?? null;
if (!is_array($file)) fail('No media file was received', 422);
$error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
if ($error !== UPLOAD_ERR_OK) fail('The media upload failed', 422);
$tmp = (string)($file['tmp_name'] ?? '');
if ($tmp === '' || !is_uploaded_file($tmp)) fail('The uploaded media could not be verified', 422);
$size = (int)($file['size'] ?? 0);
if ($size <= 0) fail('The selected media file is empty', 422);
if ($size > 100 * 1024 * 1024) fail('Creator Clicks videos must be 100 MB or smaller', 422);

$mime = cloudcomai_detect_mime_type($tmp);
$types = [
    'image/jpeg' => ['jpg', 'image'],
    'image/png' => ['png', 'image'],
    'image/webp' => ['webp', 'image'],
    'video/mp4' => ['mp4', 'video'],
    'video/quicktime' => ['mov', 'video'],
    'video/webm' => ['webm', 'video'],
];
if (!isset($types[$mime])) fail('Creator Clicks supports JPG, PNG, WebP, MP4, MOV and WebM files', 422);
[$extension, $kind] = $types[$mime];
if ($kind === 'image') {
    if ($size > 10 * 1024 * 1024) fail('Each Creator Clicks image must be 10 MB or smaller', 422);
    $image = @getimagesize($tmp);
    if (!$image || empty($image[0]) || empty($image[1]) || (int)$image[0] > 8000 || (int)$image[1] > 8000) {
        fail('The selected image is invalid or exceeds 8000 x 8000 pixels', 422);
    }
    $duration = null;
} else {
    if (!function_exists('shell_exec')) fail('Server-side video duration validation is unavailable; contact support', 503);
    $command = 'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ' . escapeshellarg($tmp) . ' 2>/dev/null';
    $rawDuration = @shell_exec($command);
    if (!is_string($rawDuration) || !is_numeric(trim($rawDuration))) fail('The server could not verify the video duration', 422);
    $duration = (float)trim($rawDuration);
    if ($duration <= 0 || $duration > 160) fail('Creator Clicks videos must be 160 seconds or shorter', 422);
}

$folder = dirname(__DIR__) . '/uploads/creator-clicks/' . $userId;
if (!is_dir($folder) && !mkdir($folder, 0755, true) && !is_dir($folder)) fail('Unable to prepare Creator Clicks media storage', 500);
if (!is_writable($folder)) fail('Creator Clicks media storage is not writable', 500);
try {
    $filename = bin2hex(random_bytes(16)) . '.' . $extension;
} catch (Throwable $exception) {
    fail('Unable to generate a secure media filename', 500);
}
$destination = $folder . DIRECTORY_SEPARATOR . $filename;
if (!move_uploaded_file($tmp, $destination)) fail('Unable to save Creator Clicks media', 500);

out([
    'filename' => $filename,
    'type' => $kind,
    'mime_type' => $mime,
    'size_bytes' => $size,
    'duration_seconds' => $duration,
], 201);
