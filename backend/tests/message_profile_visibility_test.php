<?php
$messages = file_get_contents(__DIR__ . '/../api/messages.php');
$media = file_get_contents(__DIR__ . '/../../apps/mobile/src/components/MediaMessage.js');

if (strpos($messages, 'AS show_profile') === false) { fwrite(STDERR, "messages API must expose show_profile\n"); exit(1); }
if (strpos($messages, 'c.type="public"') === false || strpos($messages, 'friend_requests') === false || strpos($messages, 'fr.status="accepted"') === false) { fwrite(STDERR, "public non-friend profile visibility rule missing\n"); exit(1); }
if (strpos($media, 'Number(message.show_profile) === 1') === false) { fwrite(STDERR, "mobile media must normalize profile visibility flag\n"); exit(1); }
if (strpos($media, 'profileAction') === false || strpos($media, 'UserProfileModal') === false) { fwrite(STDERR, "mobile public profile action missing\n"); exit(1); }

echo "Message profile visibility checks passed.\n";
