<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$contract = json_decode((string)file_get_contents($root . '/api-contract.json'), true, 512, JSON_THROW_ON_ERROR);
assert($contract['routes']['v1/friend-requests']['handler'] === 'friend_requests.php');
assert($contract['routes']['v1/friend-requests']['methods'] === ['GET', 'POST']);
assert($contract['routes']['v1/friend-requests']['auth'] === true);

$handler = (string)file_get_contents($root . '/api/friend_requests.php');
foreach (['send','accept','decline','block','cancel','friend_requests','users_block_state','GET_LOCK','queue_user_notification','friend_request_accepted','friend_request_declined'] as $needle) {
    assert(str_contains($handler, $needle), "Missing friend request handler contract: {$needle}");
}

$notifications = (string)file_get_contents($root . '/api/notifications.php');
foreach (['friend_request','friend_request_accepted','friend_request_declined'] as $event) {
    assert(str_contains($notifications, $event), "Missing Alerts event: {$event}");
}

$profile = (string)file_get_contents($root . '/api/user_profile.php');
assert(str_contains($profile, 'shared_chat.type IN ("private","public")'));
assert(str_contains($profile, "'relationship' => $relationship"));

$migration = (string)file_get_contents($root . '/database/migrations/014_friend_requests.sql');
$fresh = (string)file_get_contents($root . '/database/fresh-install.sql');
foreach ([$migration, $fresh] as $sql) {
    assert(str_contains($sql, 'CREATE TABLE IF NOT EXISTS friend_requests'));
    assert(str_contains($sql, "ENUM('pending','accepted','declined','blocked','cancelled')"));
    assert(str_contains($sql, 'requester_id BIGINT UNSIGNED NOT NULL'));
    assert(str_contains($sql, 'recipient_id BIGINT UNSIGNED NOT NULL'));
}
assert(str_contains($fresh, "'014_friend_requests.sql'"));

$publicMigration = (string)file_get_contents($root . '/database/migrations/013_public_city_chat_rooms.sql');
assert(str_contains($publicMigration, "c.type='public'"));

echo "friend_requests_feature_test.php passed\n";
