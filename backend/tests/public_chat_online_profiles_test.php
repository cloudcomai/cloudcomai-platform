<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$handler = (string)file_get_contents($root . '/api/public_chats.php');
foreach ([
    "u.dob,u.gender",
    "LEFT JOIN profile_visibility pv ON pv.user_id=u.id",
    "COALESCE(pv.share_age,1) AS share_age",
    "COALESCE(pv.share_gender,1) AS share_gender",
    "public_room_relationship_for_users((int)\$user['id'],\$memberId)",
    "SELECT id,status,requester_id,recipient_id FROM friend_requests",
    "return ['status' => 'none'];",
    "'age_private'",
    "'gender_private'",
    "'image_version'",
    "time()-90",
] as $needle) {
    assert(str_contains($handler, $needle), "Missing online-room profile privacy or relationship behavior: {$needle}");
}

$friendHandler = (string)file_get_contents($root . '/api/friend_requests.php');
assert(str_contains($friendHandler, "if (\$action === 'accept')"));
assert(str_contains($friendHandler, "UPDATE friend_requests SET status=\"accepted\""));
assert(str_contains($friendHandler, "Only the recipient can respond to this friend request"));
assert(str_contains($friendHandler, "'event' => 'friend_request'"));

$contacts = (string)file_get_contents($root . '/api/contacts.php');
assert(str_contains($contacts, 'fr.status="accepted"'));
echo "public_chat_online_profiles_test.php passed\n";
