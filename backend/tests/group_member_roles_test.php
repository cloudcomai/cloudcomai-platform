<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$handler = (string) file_get_contents($root . '/api/group_members.php');
assert(str_contains($handler, "'promote_admin', 'demote_admin'"));
assert(str_contains($handler, 'Only the group owner can manage administrators'));
assert(str_contains($handler, 'at most 3 admins'));
assert(str_contains($handler, 'COUNT(*) FROM chat_members'));
echo "group_member_roles_test.php passed\\n";
