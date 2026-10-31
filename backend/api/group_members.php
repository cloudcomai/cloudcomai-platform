<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST'], true)) fail('Method not allowed', 405);
$data = $method === 'POST' ? input() : [];
$chatId = (int)($method === 'GET' ? ($_GET['chat_id'] ?? 0) : ($data['chat_id'] ?? 0));
$userId = (int)$user['id'];
$pdo = db();

// Memberships always reference users.id. Comparing a username with this numeric
// column lets MySQL coerce a numeric username prefix into somebody else's ID.
$membership = $pdo->prepare('SELECT cm.role,c.owner_id FROM chat_members cm INNER JOIN chats c ON c.id=cm.chat_id AND c.type="group" WHERE cm.chat_id=? AND cm.user_id=? AND cm.status="active" LIMIT 1');
$membership->execute([$chatId, $userId]);
$member = $membership->fetch();
if (!$member) fail('Group not found or access denied', 403);

if ($method === 'GET') {
    $members = $pdo->prepare('SELECT cm.user_id,cm.role,cm.status,u.name,u.user_id AS username FROM chat_members cm INNER JOIN users u ON u.id=cm.user_id WHERE cm.chat_id=? AND cm.status="active" ORDER BY cm.user_id');
    $members->execute([$chatId]);
    $rows = $members->fetchAll();
    $uploadFolder = __DIR__ . '/../uploads/users';
    foreach ($rows as &$row) {
        $row['user_id'] = (int)$row['user_id'];
        $row['image_version'] = null;
        foreach (glob($uploadFolder . '/' . $row['user_id'] . '.*') ?: [] as $photo) {
            if (is_file($photo)) {
                $row['image_version'] = (string)(filemtime($photo) ?: 0) . '-' . (string)filesize($photo);
                break;
            }
        }
    }
    unset($row);
    out(['members' => $rows]);
}

$targetId = (int)($data['user_id'] ?? 0);
$action = (string)($data['action'] ?? 'add');
if ($targetId <= 0 || !in_array($action, ['add', 'remove', 'promote_admin', 'demote_admin'], true)) fail('Valid member and action are required');

try {
    $pdo->beginTransaction();
    // Serialize membership actions and recheck the actor after acquiring the lock.
    $lock = $pdo->prepare('SELECT owner_id,name FROM chats WHERE id=? AND type="group" FOR UPDATE');
    $lock->execute([$chatId]);
    $group = $lock->fetch();
    if (!$group) fail('Group not found or access denied', 403);
    $ownerId = (int)$group['owner_id'];
    $groupName = trim((string)($group['name'] ?? ''));
    $membership->execute([$chatId, $userId]);
    $member = $membership->fetch();
    if (!$member) fail('Group not found or access denied', 403);
    $target = $pdo->prepare('SELECT cm.role,cm.status,u.name,u.user_id AS username FROM chat_members cm INNER JOIN users u ON u.id=cm.user_id WHERE cm.chat_id=? AND cm.user_id=?');
    $target->execute([$chatId, $targetId]);
    $existing = $target->fetch();

    if (in_array($action, ['promote_admin', 'demote_admin'], true)) {
        if ($userId !== $ownerId || $member['role'] !== 'owner') fail('Only the group owner can manage administrators', 403);
        if (!$existing || $existing['status'] !== 'active' || $targetId === $ownerId) fail('Choose an active group member', 422);
        if ($action === 'promote_admin') {
            $admins = $pdo->prepare('SELECT COUNT(*) FROM chat_members WHERE chat_id=? AND status="active" AND role="admin"');
            $admins->execute([$chatId]);
            if ($existing['role'] !== 'admin' && (int)$admins->fetchColumn() >= 3) fail('A group can have at most 3 admins', 422);
            $pdo->prepare('UPDATE chat_members SET role="admin" WHERE chat_id=? AND user_id=? AND status="active"')->execute([$chatId, $targetId]);
        } else {
            if ($existing['role'] !== 'admin') fail('This member is not an admin', 422);
            $pdo->prepare('UPDATE chat_members SET role="member" WHERE chat_id=? AND user_id=? AND status="active"')->execute([$chatId, $targetId]);
        }
    } elseif ($action === 'add') {
        $account = $pdo->prepare('SELECT id,name,user_id FROM users WHERE id=? AND account_status="active"');
        $account->execute([$targetId]);
        $targetAccount = $account->fetch();
        if (!$targetAccount) fail('User is unavailable', 404);
        if ($existing && $existing['status'] === 'banned') fail('This member is banned from the group', 403);
        $addedNewMember = !$existing || $existing['status'] !== 'active';
        if ($addedNewMember) {
            $role = $targetId === $ownerId ? 'owner' : 'member';
            $pdo->prepare('INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,?,"active",UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status="active",role=VALUES(role),joined_at=UTC_TIMESTAMP()')->execute([$chatId, $targetId, $role]);

            // Welcome the newly activated member in the group timeline. Keep
            // the event and notifications atomic with the membership change.
            $targetName = trim((string)($targetAccount['name'] ?? ''));
            if ($targetName === '') $targetName = trim((string)($targetAccount['user_id'] ?? 'A member'));
            $welcomeGroupName = $groupName !== '' ? $groupName : 'the group';
            $welcomeBody = 'Welcome ' . $targetName . ' to ' . $welcomeGroupName . '!';
            $welcomeMessage = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,created_at) VALUES(?, ?, "system", ?, UTC_TIMESTAMP())');
            $welcomeMessage->execute([$chatId, $userId, $welcomeBody]);
            $welcomeMessageId = (int)$pdo->lastInsertId();
            create_chat_notifications($chatId, $userId, (string)($user['name'] ?? 'Group admin'), $welcomeBody, $welcomeMessageId);
        }
    } else {
        if (!$existing || $existing['status'] !== 'active') fail('This member is not active in the group', 404);
        if ($targetId === $ownerId || $existing['role'] === 'owner') {
            fail('The group owner cannot leave or be removed. Transfer ownership first or delete the group.', 403);
        }
        $isSelfAction = $userId === $targetId;
        if (!$isSelfAction && !in_array($member['role'], ['owner', 'admin'], true)) {
            fail('Only the group owner or an admin can remove other members', 403);
        }
        $pdo->prepare('UPDATE chat_members SET status="removed" WHERE chat_id=? AND user_id=? AND status="active"')->execute([$chatId, $targetId]);

        // Publish the membership change as a normal group system message and
        // notify the remaining active members within the same transaction.
        $targetName = trim((string)($existing['name'] ?? ''));
        if ($targetName === '') $targetName = trim((string)($existing['username'] ?? 'A member'));
        $isSelfAction = $userId === $targetId;
        $systemBody = $isSelfAction
            ? $targetName . ' left the group'
            : $targetName . ' was removed from the group';
        $systemMessage = $pdo->prepare('INSERT INTO messages(chat_id,sender_id,type,body,created_at) VALUES(?, ?, "system", ?, UTC_TIMESTAMP())');
        $systemMessage->execute([$chatId, $userId, $systemBody]);
        $systemMessageId = (int)$pdo->lastInsertId();
        create_chat_notifications($chatId, $userId, (string)($user['name'] ?? 'Group admin'), $systemBody, $systemMessageId);
    }
    $pdo->commit();
    out(['status' => 'ok', 'message' => $action === 'add' ? 'Member added successfully' : ($userId === $targetId ? 'You have left the group' : 'Member removed successfully')]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Group membership update failed: ' . $error->getMessage());
    fail('Unable to update group membership', 500);
}
