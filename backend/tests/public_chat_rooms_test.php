<?php

declare(strict_types=1);

$contract = json_decode((string)file_get_contents(__DIR__ . '/../api-contract.json'), true, 512, JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/public-chats']), 'Public chats route must be registered');
assert($contract['routes']['v1/public-chats']['handler'] === 'public_chats.php');
assert(in_array('GET', $contract['routes']['v1/public-chats']['methods'], true));
assert(in_array('POST', $contract['routes']['v1/public-chats']['methods'], true));

$handler = file_get_contents(__DIR__ . '/../api/public_chats.php');
assert(is_string($handler) && str_contains($handler, "c.type='public'"));
assert(str_contains($handler, "c.group_category='india-city'"));
assert(str_contains($handler, 'LIMIT 50'));
assert(str_contains($handler, 'INSERT INTO chat_members'));
assert(str_contains($handler, '$roomQuery = $pdo->prepare'));

$fresh = file_get_contents(__DIR__ . '/../database/fresh-install.sql');
assert(is_string($fresh));
assert(substr_count($fresh, "'public', v.name, 'india-city'") === 1);
assert(substr_count($fresh, "SELECT 'Ahmedabad'") === 1);
assert(substr_count($fresh, "SELECT 'Warangal'") === 1);
assert(substr_count($fresh, "SELECT '") === 50, 'Fresh-install schema must contain exactly 50 city/town rows');

$migration = file_get_contents(__DIR__ . '/../database/migrations/011_public_city_chat_rooms.sql');
assert(is_string($migration));
assert(str_contains($migration, "WHERE NOT EXISTS"));
assert(substr_count($migration, "SELECT '") === 50, 'Migration must contain exactly 50 city/town rows');

echo "public_chat_rooms_test.php passed\n";
