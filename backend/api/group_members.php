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
    $members = $pdo->prepare('SELECT cm.user_id,cm.role,u.name,u.user_id AS username FROM chat_members cm INNER JOIN users u ON u.id=cm.user_id WHERE cm.chat_id=? AND cm.status="active" ORDER BY cm.user_id');
    $members->execute([$chatId]);
    out(['members' => $members->fetchAll()]);
}

$targetId = (int)($data['user_id'] ?? 0);
$action = (string)($data['action'] ?? 'add');
if ($targetId <= 0 || !in_array($action, ['add', 'remove'], true)) fail('Valid member and action are required');

try {
    $pdo->beginTransaction();
    // Serialize membership actions and recheck the actor after acquiring the lock.
    $lock = $pdo->prepare('SELECT owner_id FROM chats WHERE id=? AND type="group" FOR UPDATE');
    $lock->execute([$chatId]);
    $ownerId = (int)$lock->fetchColumn();
    $membership->execute([$chatId, $userId]);
    $member = $membership->fetch();
    if (!$member) fail('Group not found or access denied', 403);
    $target = $pdo->prepare('SELECT role,status FROM chat_members WHERE chat_id=? AND user_id=?');
    $target->execute([$chatId, $targetId]);
    $existing = $target->fetch();

    if ($action === 'add') {
        $account = $pdo->prepare('SELECT id FROM users WHERE id=? AND account_status="active"');
        $account->execute([$targetId]);
        if (!$account->fetchColumn()) fail('User is unavailable', 404);
        if ($existing && $existing['status'] === 'banned') fail('This member is banned from the group', 403);

        // Adding an active member again is a no-op, especially for owners/admins.
        if (!$existing || $existing['status'] !== 'active') {
            $role = $targetId === $ownerId ? 'owner' : 'member';
            $pdo->prepare('INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,?,"active",UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status="active",role=VALUES(role),joined_at=UTC_TIMESTAMP()')->execute([$chatId, $targetId, $role]);
        }
    } else {
        if ($targetId === $ownerId || ($existing && $existing['role'] === 'owner')) {
            fail('The group owner cannot leave or be removed. Transfer ownership first or delete the group.', 403);
        }
        if (!in_array($member['role'], ['owner', 'admin'], true) && $userId !== $targetId) {
            fail('Only administrators can remove other members', 403);
        }
        $pdo->prepare('UPDATE chat_members SET status="removed" WHERE chat_id=? AND user_id=?')->execute([$chatId, $targetId]);
    }
    $pdo->commit();
    out(['status' => 'ok', 'message' => $action === 'add' ? 'Member added successfully' : 'Member removed successfully']);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Group membership update failed: ' . $error->getMessage());
    fail('Unable to update group membership', 500);
}
