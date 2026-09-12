<?php
declare(strict_types=1);

$contract=json_decode((string)file_get_contents(__DIR__.'/../api-contract.json'),true,512,JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/public-chats']));
assert($contract['routes']['v1/public-chats']['handler']==='public_chats.php');
assert(in_array('GET',$contract['routes']['v1/public-chats']['methods'],true));
assert(in_array('POST',$contract['routes']['v1/public-chats']['methods'],true));

$handler=(string)file_get_contents(__DIR__.'/../api/public_chats.php');
assert(str_contains($handler,"c.type='public'"));
assert(str_contains($handler,"c.group_category='india-city'"));
assert(str_contains($handler,'joined_users'));
assert(str_contains($handler,'online_users'));
assert(!str_contains($handler,'total_messages'));
assert(str_contains($handler,"ORDER BY CASE WHEN cm.status='active' THEN 0 ELSE 1 END"));
assert(str_contains($handler,"action = strtolower"));
assert(str_contains($handler,"action === 'leave'"));
assert(str_contains($handler,"UPDATE chat_members SET status='removed'"));
assert(str_contains($handler,"hidden=1"));
assert(str_contains($handler,'LIMIT 50'));
assert(str_contains($handler,'INSERT INTO chat_members'));

$api=(string)file_get_contents(__DIR__.'/../../packages/api-client/src/cloudcomai-api.js');
assert(str_contains($api,'listPublicChats'));
assert(str_contains($api,'joinPublicChat'));
assert(str_contains($api,'leavePublicChat'));

$ui=(string)file_get_contents(__DIR__.'/../../apps/mobile/src/components/PublicChatsList.js');
assert(str_contains($ui,'Favorites'));
assert(str_contains($ui,'joined_users'));
assert(str_contains($ui,'online_users'));
assert(str_contains($ui,'👥 ${item.joined_users} Joined · 🟢 ${item.online_users} Online'));
assert(str_contains($ui,'Joined rooms'));
assert(str_contains($ui,'All public rooms'));
assert(str_contains($ui,'Blocked Contacts'));
assert(str_contains($ui,'platformApi.unblockContact'));
assert(str_contains($ui,'platformApi.joinPublicChat'));

$fresh=(string)file_get_contents(__DIR__.'/../database/fresh-install.sql');
$migration=(string)file_get_contents(__DIR__.'/../database/migrations/013_public_city_chat_rooms.sql');
foreach ([$fresh,$migration] as $sql) {
    assert(str_contains($sql,'WHERE NOT EXISTS'));
    assert(substr_count($sql,"UNION ALL SELECT")+1===50);
    assert(str_contains($sql,"SELECT 'Ahmedabad'"));
    assert(str_contains($sql,"'Warangal'"));
}
assert(str_contains($fresh,"'013_public_city_chat_rooms.sql'"));

echo "public_chat_rooms_test.php passed\n";
