<?php
declare(strict_types=1);

$contract=json_decode((string)file_get_contents(__DIR__.'/../api-contract.json'),true,512,JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/public-chats']));
assert($contract['routes']['v1/public-chats']['handler']==='public_chats.php');
assert(in_array('GET',$contract['routes']['v1/public-chats']['methods'],true));
assert(in_array('POST',$contract['routes']['v1/public-chats']['methods'],true));
assert(in_array('DELETE',$contract['routes']['v1/public-chats']['methods'],true));

$handler=(string)file_get_contents(__DIR__.'/../api/public_chats.php');
assert(str_contains($handler,"c.type='public'"));
assert(str_contains($handler,"c.room_type IN ('city','language')"));
assert(str_contains($handler,'language_code'));
assert(str_contains($handler,'room_type'));
assert(str_contains($handler,'LIMIT 50'));
assert(str_contains($handler,'INSERT INTO chat_members'));
assert(str_contains($handler,"AS joined_count"));
assert(str_contains($handler,"AS online_count"));
assert(str_contains($handler,'UTC_TIMESTAMP() - INTERVAL 90 SECOND'));
assert(str_contains($handler,'hide_online_status'));
assert(str_contains($handler,"\$method === 'DELETE'"));
assert(str_contains($handler,"status='removed'"));
assert(str_contains($handler,'notifications_muted=1'));
assert(str_contains($handler,'c.name LIKE'));
assert(str_contains($handler,'favorites'));
assert(str_contains($handler,"cm.status='active'"));

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

$languageMigration=(string)file_get_contents(__DIR__.'/../database/migrations/022_public_language_chat_rooms.sql');
assert(str_contains($languageMigration,"'French','fr'"));
assert(str_contains($languageMigration,"'Manipuri (Meitei)','mni'"));
assert(substr_count($languageMigration,"UNION ALL SELECT")+1===21);
assert(str_contains($languageMigration,"room_type='language'"));
foreach ([$fresh,$languageMigration] as $sql) {
    assert(str_contains($sql,"'French','fr'"));
    assert(str_contains($sql,"'Telugu','te'"));
    assert(str_contains($sql,"'Urdu','ur'"));
}
