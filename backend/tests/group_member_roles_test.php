<?php
declare(strict_types=1);
$root = dirname(__DIR__);
$handler = (string) file_get_contents($root . '/api/group_members.php');
assert(str_contains($handler, "'promote_admin', 'demote_admin'"));
assert(str_contains($handler, 'Only the group owner can manage administrators'));
assert(str_contains($handler, 'at most 3 admins'));
assert(str_contains($handler, 'COUNT(*) FROM chat_members'));
assert(str_contains($handler, "'image_version'"));
assert(str_contains($handler, "SELECT cm.user_id,cm.role,cm.status,u.name,u.user_id AS username"));
assert(str_contains($handler, 'Only the group owner or an admin can remove other members'));
assert(str_contains($handler, '$isSelfAction = $userId === $targetId'));
assert(str_contains($handler, 'This member is not active in the group'));
$accessHandler = (string) file_get_contents($root . '/api/group_attachment_access.php');
assert(str_contains($accessHandler, 'Active group members may view effective attachment permission indicators'));
assert(str_contains($accessHandler, 'Only the group owner can manage attachment access'));
echo "group_member_roles_test.php passed\\n";
