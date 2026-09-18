<?php
declare(strict_types=1);

$contract=json_decode((string)file_get_contents(__DIR__.'/../api-contract.json'),true,512,JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/public-chats']));
assert(in_array('GET',$contract['routes']['v1/public-chats']['methods'],true));
assert(in_array('POST',$contract['routes']['v1/public-chats']['methods'],true));
assert(in_array('DELETE',$contract['routes']['v1/public-chats']['methods'],true));

$handler=(string)file_get_contents(__DIR__.'/../api/public_chats.php');
foreach([
    'public_chat_reports',
    'public_chat_restrictions',
    'COUNT(DISTINCT reporter_id)',
    'INSERT IGNORE INTO public_chat_reports',
    'status=\'banned\'',
    'public_chat_block',
    'public_chat_moderation',
    'persistent_moderation',
    '7*86400',
    'FOR UPDATE',
    'You cannot report yourself'
] as $needle) assert(str_contains($handler,$needle),$needle);

$messages=(string)file_get_contents(__DIR__.'/../api/messages.php');
assert(str_contains($messages,'around_id'));
assert(str_contains($messages,'ORDER BY m.id DESC LIMIT 101'));

$bootstrap=(string)file_get_contents(__DIR__.'/../lib/bootstrap.php');
assert(str_contains($bootstrap,'public_chat_restrictions'));
assert(str_contains($bootstrap,'temporarily restricted'));

$notifications=(string)file_get_contents(__DIR__.'/../lib/notifications.php');
assert(str_contains($notifications,'persistent_moderation'));

$migration=(string)file_get_contents(__DIR__.'/../database/migrations/021_public_chat_moderation.sql');
$fresh=(string)file_get_contents(__DIR__.'/../database/fresh-install.sql');
foreach(['public_chat_reports','public_chat_restrictions','blocked_at','blocked_until'] as $needle){
 assert(str_contains($migration,$needle),$needle);
 assert(str_contains($fresh,$needle),$needle);
}
echo "public_chat_moderation_test.php passed\n";
