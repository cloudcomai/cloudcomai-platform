<?php
declare(strict_types=1);

$upload = file_get_contents(__DIR__ . '/../api/upload_attachment.php');
$attachment = file_get_contents(__DIR__ . '/../api/attachment.php');
$payload = file_get_contents(__DIR__ . '/../lib/message_payload.php');
$migration = file_get_contents(__DIR__ . '/../database/migrations/020_video_message_metadata.sql');
$fresh = file_get_contents(__DIR__ . '/../database/fresh-install.sql');
$schema = file_get_contents(__DIR__ . '/../sql/schema.sql');

function assert_match(string $pattern, string $subject, string $message): void {
    if (preg_match($pattern, $subject) !== 1) { fwrite(STDERR, "FAIL: {$message}\n"); exit(1); }
}

assert_match("/\$requestedType === 'video'/", $upload, 'upload endpoint accepts video message type');
assert_match("/thumbnail_path/", $upload, 'upload endpoint persists thumbnail path');
assert_match("/command -v ffmpeg/", $upload, 'server generates thumbnails with ffmpeg when available');
assert_match("/video_width/", $upload, 'upload endpoint accepts video dimensions');
assert_match("/video_duration_seconds/", $upload, 'upload endpoint accepts video duration');
assert_match("/\$_GET\['thumbnail'\]/", $attachment, 'attachment endpoint supports protected thumbnail delivery');
assert_match("/Accept-Ranges: bytes/", $attachment, 'video attachment delivery supports range requests');
assert_match("/thumbnail_available/", $payload, 'chat payload exposes thumbnail availability');
assert_match("/duration_seconds/", $payload, 'chat payload exposes video duration');
assert_match("/ADD COLUMN thumbnail_filename/", $migration, 'incremental video migration adds thumbnail metadata');
assert_match("/thumbnail_filename VARCHAR\(255\) NULL/", $fresh, 'fresh install includes thumbnail metadata');
assert_match("/duration_seconds DECIMAL\(10,3\)/", $fresh, 'fresh install includes duration metadata');
assert_match("/020_video_message_metadata\.sql/", $fresh, 'fresh install records the current video migration version');
assert_match("/thumbnail_filename VARCHAR\(255\) NULL/", $schema, 'consolidated schema includes thumbnail metadata');

echo "video messaging backend contract tests passed\n";
