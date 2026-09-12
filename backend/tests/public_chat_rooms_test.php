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
assert(str_contains($handler,'LIMIT 50'));
assert(str_contains($handler,'INSERT INTO chat_members'));
assert(str_contains($handler,"AS joined_count"));
assert(str_contains($handler,"AS online_count"));
assert(str_contains($handler,'UTC_TIMESTAMP() - INTERVAL 90 SECOND'));
assert(str_contains($handler,'hide_online_status'));

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
