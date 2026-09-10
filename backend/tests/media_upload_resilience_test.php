<?php

declare(strict_types=1);

$upload = file_get_contents(__DIR__ . '/../api/upload_attachment.php');
$index = file_get_contents(__DIR__ . '/../api/index.php');
$migration = file_get_contents(__DIR__ . '/../database/migrations/015_media_message_type_compatibility.sql');

function expect_media(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

expect_media($upload !== false, 'Unable to read upload_attachment.php');
expect_media($index !== false, 'Unable to read api/index.php');
expect_media($migration !== false, 'Unable to read media compatibility migration');

$commitPos = strpos($upload, '$pdo->commit();');
$notifyPos = strpos($upload, 'create_chat_notifications(');
expect_media($commitPos !== false && $notifyPos !== false && $commitPos < $notifyPos, 'Media must commit before notification creation');
expect_media(str_contains($upload, "error_log('Media notification creation failed"), 'Notification failures must be logged without failing stored media');
expect_media(str_contains($upload, "fail('Unable to send media', 500)"), 'Media persistence failures must return a media-specific error');

$routerCatchPos = strpos($index, "error_log('API router failure:");
$handlerCatchPos = strpos($index, "error_log('API handler failure [");
$requirePos = strpos($index, 'require $result[\'handler\'];');
expect_media($routerCatchPos !== false, 'Router failure logging missing');
expect_media($requirePos !== false && $handlerCatchPos !== false && $requirePos < $handlerCatchPos, 'Handler execution must have its own failure handling');
expect_media(str_contains($index, "'API request failed'"), 'Handler exceptions must not be reported as router unavailable');

expect_media(str_contains($migration, 'MODIFY COLUMN type VARCHAR(40)'), 'Legacy message type column must be widened for voice/video compatibility');

echo "Media upload resilience tests passed\n";
