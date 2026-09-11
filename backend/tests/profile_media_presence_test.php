<?php
declare(strict_types=1);

function expect_contract(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$media=file_get_contents(__DIR__.'/../api/media.php');$mediaUpload=file_get_contents(__DIR__.'/../api/media_upload.php');$userProfile=file_get_contents(__DIR__.'/../api/user_profile.php');$profile=file_get_contents(__DIR__.'/../api/profile.php');$heartbeat=file_get_contents(__DIR__.'/../api/heartbeat.php');$chats=file_get_contents(__DIR__.'/../api/chats.php');$groups=file_get_contents(__DIR__.'/../api/groups.php');$contacts=file_get_contents(__DIR__.'/../api/contacts.php');$phoneContacts=file_get_contents(__DIR__.'/../api/phone_contacts.php');$mobilePlatform=file_get_contents(__DIR__.'/../../apps/mobile/src/services/platform.js');$mobileContacts=file_get_contents(__DIR__.'/../../apps/mobile/src/utils/contacts.js');
expect_contract(str_contains($media,'Cache-Control: private, no-cache'),'Profile media must not use a reusable public cache');
expect_contract(str_contains($media,'Pragma: no-cache'),'Profile media must include a no-cache compatibility header');
expect_contract(str_contains($mediaUpload,"'image_version' => \$imageVersion"),'Media upload must return a unique image version');
expect_contract(str_contains($profile,"'image_version'=>\$imageVersion"),'Profile updates must preserve the image version');
expect_contract(str_contains($userProfile,"'online' => \$online"),'User profile responses must expose presence state');
expect_contract(str_contains($heartbeat,'UPDATE users SET updated_at=UTC_TIMESTAMP()'),'Heartbeat must refresh presence timestamp');
expect_contract(str_contains($chats,"'image_version'] ="),'Chat responses must expose avatar versions');
expect_contract(str_contains($groups,"'image_version'] ="),'Group responses must expose avatar versions');
expect_contract(str_contains($chats,'AND (c.type <> "private" OR m.id IS NOT NULL)'),'Empty private chats must be excluded from chat list');
expect_contract(str_contains($contacts,'merge_contact_sources'),'Contacts API must merge all contact sources');
expect_contract(str_contains($contacts,'friend_requests'),'Accepted CloudComAI friends must be included in contacts');
expect_contract(str_contains($phoneContacts,'DELETE FROM phone_contacts'),'Phone sync must replace the caller snapshot without duplicating records');
expect_contract(preg_match('/setInterval\(sendPresenceHeartbeat,\s*30000\)/',$mobilePlatform)===1,'Mobile presence must refresh every 30 seconds');
expect_contract(str_contains($mobilePlatform,"nextState==='active'"),'Presence heartbeat must follow app foreground state');
expect_contract(str_contains($mobilePlatform,'stopPresenceHeartbeat();'),'Mobile logout/session expiry must stop presence heartbeats');
expect_contract(str_contains($mobileContacts,'Contact.getAllDetails'),'Phone contacts must use the stable Expo Contacts API');

echo "Profile media and presence contract tests passed\n";
