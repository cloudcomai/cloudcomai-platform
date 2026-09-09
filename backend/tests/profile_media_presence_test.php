<?php
declare(strict_types=1);

function expect_contract(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$media = file_get_contents(__DIR__ . '/../api/media.php');
$mediaUpload = file_get_contents(__DIR__ . '/../api/media_upload.php');
$userProfile = file_get_contents(__DIR__ . '/../api/user_profile.php');
$profile = file_get_contents(__DIR__ . '/../api/profile.php');
$heartbeat = file_get_contents(__DIR__ . '/../api/heartbeat.php');
$chats = file_get_contents(__DIR__ . '/../api/chats.php');
$groups = file_get_contents(__DIR__ . '/../api/groups.php');
$mobilePlatform = file_get_contents(__DIR__ . '/../../apps/mobile/src/services/platform.js');

expect_contract(str_contains($media, 'Cache-Control: private, no-cache'), 'Profile media must not use a reusable public cache');
expect_contract(str_contains($media, 'Pragma: no-cache'), 'Profile media must include a no-cache compatibility header');
expect_contract(str_contains($mediaUpload, "'image_version' => \$imageVersion"), 'Media upload must return a unique image version');
expect_contract(str_contains($profile, "'image_version'=>\$imageVersion"), 'Profile updates must preserve the image version');
expect_contract(str_contains($userProfile, "'online' => \$online"), 'User profile responses must expose presence state');
expect_contract(str_contains($heartbeat, 'UPDATE users SET updated_at=UTC_TIMESTAMP()'), 'Heartbeat must refresh presence timestamp');
expect_contract(str_contains($chats, "'image_version'] ="), 'Chat responses must expose avatar versions');
expect_contract(str_contains($groups, "'image_version'] ="), 'Group responses must expose avatar versions');
expect_contract(str_contains($mobilePlatform, 'setInterval(sendPresenceHeartbeat, 30000)'), 'Mobile presence must refresh every 30 seconds');
expect_contract(str_contains($mobilePlatform, 'stopPresenceHeartbeat();'), 'Mobile logout/session expiry must stop presence heartbeats');

echo "Profile media and presence contract tests passed\n";
