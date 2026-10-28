<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$handler = (string) file_get_contents($root . '/api/groups.php');
$fresh = (string) file_get_contents($root . '/database/fresh-install.sql');
$migration = (string) file_get_contents($root . '/database/migrations/029_group_description.sql');
$mobile = (string) file_get_contents(dirname($root) . '/apps/mobile/src/components/GroupManagement.js');

assert(str_contains($handler, 'c.group_description'));
assert(str_contains($handler, "array_key_exists('group_description', \$d)"));
assert(str_contains($handler, 'UPDATE chats SET name=?, group_category=?, group_description=?'));
assert(str_contains($handler, 'SELECT owner_id,group_description FROM chats WHERE id=?'));
assert(str_contains($handler, "Only the group owner can edit the group description."));
assert(str_contains($migration, 'ADD COLUMN group_description VARCHAR(256) NOT NULL DEFAULT'));
assert(str_contains($fresh, 'group_description VARCHAR(256) NOT NULL DEFAULT'));
assert(substr_count($mobile, 'platformApi.listGroups()') === 1);
assert(str_contains($mobile, 'onGroupUpdated?.({ ...group, ...latestGroup })'));
assert(str_contains($mobile, 'CloudComAI could not confirm the saved group description.'));
assert(!str_contains($mobile, 'The group description was not retained by the server.'));

echo "group_description_persistence_test.php passed\n";
