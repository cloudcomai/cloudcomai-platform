<?php

require __DIR__ . '/../lib/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST'], true)) fail('Method not allowed', 405);

$data = $method === 'POST' ? input() : [];
$token = trim((string)($_GET['token'] ?? $data['token'] ?? ''));
if ($token === '' || strlen($token) > 128) fail('Invitation token required');

$pdo = db();
$invitationSql = '
    SELECT gi.id,gi.chat_id,gi.requires_approval,gi.expires_at,gi.max_uses,gi.use_count,
           c.name,c.group_category,c.retention_seconds,c.owner_id
    FROM group_invites gi
    INNER JOIN chats c ON c.id=gi.chat_id AND c.type="group"
    WHERE gi.token_hash=SHA2(?,256) AND gi.active=1
    LIMIT 1
';

$groupPayload = static fn(array $invitation): array => [
    'id' => (int)$invitation['chat_id'],
    'type' => 'group',
    'name' => $invitation['name'],
    'group_category' => $invitation['group_category'],
    'retention_seconds' => (int)$invitation['retention_seconds'],
    'owner_id' => (int)$invitation['owner_id'],
    'isGroup' => true,
    'requires_approval' => (bool)$invitation['requires_approval'],
];

if ($method === 'GET') {
    $st = $pdo->prepare($invitationSql);
    $st->execute([$token]);
    $invitation = $st->fetch();
    if (!$invitation) fail('Invalid or disabled invitation', 404);
    if ($invitation['expires_at'] && strtotime($invitation['expires_at']) < time()) fail('Invitation expired', 410);
    if ($invitation['max_uses'] !== null && (int)$invitation['use_count'] >= (int)$invitation['max_uses']) fail('Invitation usage limit reached', 410);
    out(['group' => $groupPayload($invitation)]);
}

$user = auth_user();
try {
    $pdo->beginTransaction();
    $st = $pdo->prepare($invitationSql . ' FOR UPDATE');
    $st->execute([$token]);
    $invitation = $st->fetch();
    if (!$invitation) {
        $pdo->rollBack();
        fail('Invalid or disabled invitation', 404);
    }
    if ($invitation['expires_at'] && strtotime($invitation['expires_at']) < time()) {
        $pdo->rollBack();
        fail('Invitation expired', 410);
    }
    if ($invitation['max_uses'] !== null && (int)$invitation['use_count'] >= (int)$invitation['max_uses']) {
        $pdo->rollBack();
        fail('Invitation usage limit reached', 410);
    }

    $memberQuery = $pdo->prepare('SELECT role,status FROM chat_members WHERE chat_id=? AND user_id=? LIMIT 1');
    $memberQuery->execute([$invitation['chat_id'], $user['id']]);
    $membership = $memberQuery->fetch();
    if ($membership && $membership['status'] === 'active') {
        $pdo->commit();
        out([
            'group' => $groupPayload($invitation),
            'membership_status' => 'active',
            'already_member' => true,
        ]);
    }
    if ($membership && $membership['status'] === 'banned') {
        $pdo->rollBack();
        fail('You cannot join this group', 403);
    }

    $nextStatus = (bool)$invitation['requires_approval'] ? 'pending' : 'active';
    if ($membership) {
        $update = $pdo->prepare('UPDATE chat_members SET role="member",status=?,joined_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?');
        $update->execute([$nextStatus, $invitation['chat_id'], $user['id']]);
    } else {
        $insert = $pdo->prepare('INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,"member",?,UTC_TIMESTAMP())');
        $insert->execute([$invitation['chat_id'], $user['id'], $nextStatus]);
    }

    if ($nextStatus === 'active') {
        $pdo->prepare('UPDATE group_invites SET use_count=use_count+1 WHERE id=?')->execute([$invitation['id']]);
    }
    $pdo->commit();
    out([
        'group' => $groupPayload($invitation),
        'membership_status' => $nextStatus,
        'already_member' => false,
        'message' => $nextStatus === 'pending' ? 'Join request sent for approval' : 'Group joined',
    ], $nextStatus === 'pending' ? 202 : 200);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('join.php POST error: ' . $e->getMessage());
    fail('Unable to join group', 500);
}
