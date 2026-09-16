<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$contract = json_decode((string)file_get_contents($root . '/api-contract.json'), true, 512, JSON_THROW_ON_ERROR);
assert($contract['routes']['v1/stories']['methods'] === ['GET','POST','DELETE']);
assert($contract['routes']['v1/stories']['auth'] === true);
assert($contract['routes']['v1/stories/media']['handler'] === 'story_media.php');
assert($contract['routes']['v1/stories/media/upload']['handler'] === 'story_media_upload.php');

$handler = (string)file_get_contents($root . '/api/stories.php');
foreach (['story_views','watched','view_count','viewers','deleteStory','expires_at>UTC_TIMESTAMP()','INTERVAL 36 HOUR','media_filename','photo','video'] as $needle) {
    assert(str_contains($handler, $needle), "Missing Ring Bells contract: {$needle}");
}
assert(str_contains($handler, 'INSERT IGNORE INTO story_views'));
assert(str_contains($handler, 'ORDER BY watched ASC'));
assert(str_contains($handler, 's.deleted_at IS NULL'));

$mediaUpload = (string)file_get_contents($root . '/api/story_media_upload.php');
assert(str_contains($mediaUpload, '50 * 1024 * 1024'));
assert(str_contains($mediaUpload, 'video/mp4'));
assert(str_contains($mediaUpload, 'image/jpeg'));

$media = (string)file_get_contents($root . '/api/story_media.php');
assert(str_contains($media, 'expires_at>UTC_TIMESTAMP()'));
assert(str_contains($media, 'friend_requests'));

$migration = (string)file_get_contents($root . '/database/migrations/018_ring_bells_media_views.sql');
$schema = (string)file_get_contents($root . '/sql/schema.sql');
foreach ([$migration,$schema] as $sql) {
    assert(str_contains($sql, 'story_views'));
    assert(str_contains($sql, 'PRIMARY KEY(story_id,viewer_id)') || str_contains($sql, 'PRIMARY KEY (story_id, viewer_id)'));
}

$mobile = (string)file_get_contents(dirname($root) . '/apps/mobile/src/components/RingBellsStatus.js');
foreach (['Unwatched','Watched','Count:','Photo / Video','Optional caption','deleteStory','viewStory','listStoryViewers'] as $needle) {
    assert(str_contains($mobile, $needle), "Missing mobile Ring Bells contract: {$needle}");
}

echo "ring_bells_feature_test.php passed\n";
