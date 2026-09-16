<?php

declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/media_upload.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Method not allowed', 405);
$user = auth_user();
$file = $_FILES['file'] ?? null;

if (!is_array($file)) fail('No media file was received.', 422);
$uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
if ($uploadError !== UPLOAD_ERR_OK) fail(cloudcomai_upload_error_message($uploadError), 422);

$tmpName = (string)($file['tmp_name'] ?? '');
if ($tmpName === '' || !is_uploaded_file($tmpName)) fail('The uploaded media could not be verified.', 422);

$size = (int)($file['size'] ?? 0);
if ($size <= 0) fail('The selected media file is empty.', 422);
if ($size > 50 * 1024 * 1024) fail('Ring Bell media must be 50 MB or smaller.', 422);

$mime = cloudcomai_detect_mime_type($tmpName);
if ($mime === '') {
    fail('The server cannot verify media file types. Enable PHP Fileinfo or mime_content_type and try again.', 500);
}

$extensions = [
    'image/jpeg' => ['jpg', 'photo'],
    'image/png' => ['png', 'photo'],
    'image/webp' => ['webp', 'photo'],
    'video/mp4' => ['mp4', 'video'],
    'video/quicktime' => ['mov', 'video'],
    'video/webm' => ['webm', 'video'],
];
if (!isset($extensions[$mime])) {
    fail('Ring Bells supports JPG, PNG, WebP, MP4, MOV and WebM files.', 422);
}

[$extension, $kind] = $extensions[$mime];
$folder = dirname(__DIR__) . '/uploads/stories/' . (int)$user['id'];
if (!is_dir($folder) && !mkdir($folder, 0755, true) && !is_dir($folder)) {
    fail('Unable to prepare Ring Bell media storage.', 500);
}
if (!is_writable($folder)) fail('Ring Bell media storage is not writable by the server.', 500);

try {
    $filename = bin2hex(random_bytes(16)) . '.' . $extension;
} catch (Throwable $error) {
    error_log('Ring Bell media filename generation failed: ' . $error->getMessage());
    fail('Unable to create a secure media filename.', 500);
}

$destination = $folder . '/' . $filename;
if (!move_uploaded_file($tmpName, $destination)) {
    fail('Unable to save Ring Bell media. Check the server upload directory permissions.', 500);
}

out(['type' => $kind, 'mime_type' => $mime, 'filename' => $filename], 201);