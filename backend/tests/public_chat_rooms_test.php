<?php

declare(strict_types=1);

$contract = json_decode((string)file_get_contents(__DIR__ . '/../api-contract.json'), true, 512, JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/public-chats']), 'Public chats route must be registered');
assert($contract['routes']['v1/public-chats']['handler'] === 'public_chats.php');
assert(in_array('GET', $contract['routes']['v1/public-chats']['methods'], true));
assert(in_array('POST', $contract['routes']['v1/public-chats']['methods'], true));

$handler = file_get_contents(__DIR__ . '/../api/public_chats.php');
assert(is_string($handler) && str_contains($handler, 'c.type="public"'));
assert(str_contains($handler, 'c.group_category="india-city"'));
assert(str_contains($handler, 'INSERT INTO chat_members'));

$schema = file_get_contents(__DIR__ . '/../sql/schema.sql');
assert(is_string($schema));
assert(substr_count($schema, "'public', v.name, 'india-city'") === 1);
assert(substr_count($schema, "SELECT 'Ahmedabad'") === 1);
assert(substr_count($schema, "SELECT 'Warangal'") === 1);

$migration = file_get_contents(__DIR__ . '/../sql/migrations/002_india_public_chat_rooms.sql');
assert(is_string($migration));
assert(str_contains($migration, "WHERE NOT EXISTS"));
assert(substr_count($migration, "SELECT '") === 50, 'Migration must contain exactly 50 city/town rows');

echo "public_chat_rooms_test.php passed\n";
