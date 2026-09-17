<?php

declare(strict_types=1);

$upload = file_get_contents(__DIR__ . '/../api/upload_attachment.php');
$index = file_get_contents(__DIR__ . '/../api/index.php');
$storyUpload = file_get_contents(__DIR__ . '/../api/story_media_upload.php');
$mediaHelper = file_get_contents(__DIR__ . '/../lib/media_upload.php');
$phpIni = file_get_contents(__DIR__ . '/../.user.ini');

function expect_media(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

expect_media($upload !== false, 'Unable to read upload_attachment.php');
expect_media($index !== false, 'Unable to read api/index.php');
expect_media($storyUpload !== false, 'Unable to read story_media_upload.php');
expect_media($mediaHelper !== false, 'Unable to read media_upload.php');
expect_media($phpIni !== false, 'Unable to read backend/.user.ini');

$commitPos = strpos($upload, '$pdo->commit();');
$notifyPos = strpos($upload, 'create_chat_notifications(');
expect_media($commitPos !== false && $notifyPos !== false && $commitPos < $notifyPos, 'Media must commit before notification creation');
expect_media(str_contains($upload, "error_log('Media notification creation failed"), 'Notification failures must be logged without failing stored media');
expect_media(str_contains($upload, "fail('Unable to send media. The file was uploaded but the chat message could not be saved.'"), 'Media persistence failures must return a media-specific error');
expect_media(str_contains($upload, 'is_uploaded_file'), 'Attachment upload must verify the multipart temporary file');
expect_media(str_contains($upload, 'is_writable'), 'Attachment upload must validate storage permissions');
expect_media(str_contains($upload, 'cloudcomai_upload_error_message'), 'Attachment upload must expose PHP upload error details');
expect_media(str_contains($upload, 'Detected MIME type'), 'Attachment MIME validation errors must identify the detected type');
expect_media(str_contains($upload, '25 * 1024 * 1024'), 'Attachment upload must retain the 25 MB limit');
expect_media(str_contains($upload, 'storage/attachments'), 'Attachment path must be stored relative to the protected backend storage directory');
expect_media(str_contains($phpIni, 'upload_max_filesize = 25M'), 'PHP upload_max_filesize must allow 25 MB media');
expect_media(str_contains($phpIni, 'post_max_size = 32M'), 'PHP post_max_size must exceed the 25 MB media limit');
expect_media(str_contains($phpIni, 'max_execution_time = 120'), 'PHP max_execution_time must allow media uploads to complete');

$routerCatchPos = strpos($index, "error_log('API router failure [");
$handlerCatchPos = strpos($index, "error_log('API handler failure [");
$requirePos = strpos($index, 'require $result[\'handler\'];');
expect_media($routerCatchPos !== false, 'Router failure logging missing');
expect_media($requirePos !== false && $handlerCatchPos !== false && $requirePos < $handlerCatchPos, 'Handler execution must have its own failure handling');
expect_media(str_contains($index, "'API_HANDLER_ERROR'"), 'Handler failures must expose a stable error code');
expect_media(str_contains($index, 'request_id'), 'Handler failures must expose a request id');
expect_media(str_contains($index, 'CLOUDCOMAI_API_DEBUG'), 'Raw exception details must remain opt-in');
expect_media(!str_contains($index, "'error' => 'API request failed'"), 'Generic API request failed response must not mask handler failures');

foreach (['cloudcomai_upload_error_message', 'cloudcomai_detect_mime_type', 'finfo_open', 'mime_content_type'] as $needle) {
    expect_media(str_contains($mediaHelper, $needle), "Missing media helper: {$needle}");
}
expect_media(str_contains($storyUpload, '$_FILES[\'file\']'), 'Ring Bell upload must consume the multipart file field');
expect_media(str_contains($storyUpload, 'is_uploaded_file'), 'Ring Bell upload must verify the uploaded file');
expect_media(str_contains($storyUpload, 'cloudcomai_detect_mime_type'), 'Ring Bell upload must validate MIME from file bytes');
expect_media(str_contains($storyUpload, 'is_writable'), 'Ring Bell upload must validate storage permissions');
expect_media(str_contains($storyUpload, '50 * 1024 * 1024'), 'Ring Bell upload must retain the 50 MB limit');

echo "Media upload resilience tests passed\n";
