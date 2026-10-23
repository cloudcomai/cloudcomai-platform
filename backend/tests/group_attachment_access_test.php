<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$contract = json_decode((string)file_get_contents($root . '/api-contract.json'), true, 512, JSON_THROW_ON_ERROR);
assert(isset($contract['routes']['v1/group-attachment-access']));
assert($contract['routes']['v1/group-attachment-access']['handler'] === 'group_attachment_access.php');
assert($contract['routes']['v1/group-attachment-access']['methods'] === ['GET', 'POST']);
$handler = (string)file_get_contents($root . '/api/group_attachment_access.php');
$policy = (string)file_get_contents($root . '/lib/group_attachment_access.php');
$download = (string)file_get_contents($root . '/api/attachment.php');
$forward = (string)file_get_contents($root . '/api/forward_message.php');
$fresh = (string)file_get_contents($root . '/database/fresh-install.sql');
$schema = (string)file_get_contents($root . '/sql/schema.sql');
$migration = (string)file_get_contents($root . '/database/migrations/026_group_attachment_access.sql');

assert(str_contains($handler, "SELECT owner_id FROM chats WHERE id=? AND type=\"group\" FOR UPDATE"));
assert(str_contains($handler, "in_array($action, ['grant_member','revoke_member','grant_group','revoke_group']"));
assert(str_contains($handler, "in_array($hours, [24, 48], true)"));
assert(str_contains($handler, "UPDATE group_attachment_access SET download_enabled=0,forward_enabled=0"));
assert(str_contains($policy, "grant_scope=\"member\""));
assert(str_contains($policy, "expires_at"));
assert(str_contains($download, "group_attachment_permission((int)$a['chat_id'], (int)$user['id'], 'download')"));
assert(str_contains($forward, "group_attachment_permission((int)$source['chat_id'], (int)$user['id'], 'forward')"));
foreach ([$fresh, $schema, $migration] as $sql) {
    assert(str_contains($sql, 'CREATE TABLE IF NOT EXISTS group_attachment_access'));
    assert(str_contains($sql, 'uq_group_attachment_access_scope_member'));
}
echo "group_attachment_access_test.php passed\n";
