<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

$viewer = auth_user();
$viewerId = (int)$viewer['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $targetId = (int)($_GET['user_id'] ?? $_GET['id'] ?? 0);
    if ($targetId > 0) {
        if ($targetId === $viewerId) out(['relationship' => ['status' => 'self']]);
        if (users_block_state($viewerId, $targetId)['blocked']) fail('This profile is unavailable', 403);
        out(['relationship' => relationship_for_users($viewerId, $targetId)]);
    }

    $incoming = db()->prepare('
        SELECT fr.id,fr.requester_id AS user_id,fr.created_at,u.name,u.user_id AS username
        FROM friend_requests fr
        INNER JOIN users u ON u.id=fr.requester_id AND u.account_status="active"
        WHERE fr.recipient_id=? AND fr.status="pending"
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.user_id=? AND b.blocked_user_id=fr.requester_id)
        ORDER BY fr.id DESC
    ');
    $incoming->execute([$viewerId, $viewerId]);
    $outgoing = db()->prepare('
        SELECT fr.id,fr.recipient_id AS user_id,fr.created_at,u.name,u.user_id AS username
        FROM friend_requests fr
        INNER JOIN users u ON u.id=fr.recipient_id AND u.account_status="active"
        WHERE fr.requester_id=? AND fr.status="pending"
        ORDER BY fr.id DESC
    ');
    $outgoing->execute([$viewerId]);
    out(['incoming' => $incoming->fetchAll(), 'outgoing' => $outgoing->fetchAll()]);
}

if ($method !== 'POST') fail('Method not allowed', 405);

$input = input();
$action = strtolower(trim((string)($input['action'] ?? '')));
if (!in_array($action, ['send','accept','decline','block','cancel'], true)) fail('Unsupported friend request action', 400);

if ($action === 'send') {
    $targetId = (int)($input['user_id'] ?? $input['target_user_id'] ?? 0);
    if ($targetId <= 0) fail('User id is required');
    if ($targetId === $viewerId) fail('You cannot send a friend request to yourself', 400);

    $userStmt = db()->prepare('SELECT id,name FROM users WHERE id=? AND account_status="active" LIMIT 1');
    $userStmt->execute([$targetId]);
    $targetUser = $userStmt->fetch();
    if (!$targetUser) fail('User not found', 404);

    if (users_block_state($viewerId, $targetId)['blocked']) fail('This user is blocked', 403);

    $lockName = 'cloudcomai:friend:' . min($viewerId, $targetId) . ':' . max($viewerId, $targetId);
    $lockStmt = db()->prepare('SELECT GET_LOCK(?, 5)');
    $lockStmt->execute([$lockName]);
    if ((int)$lockStmt->fetchColumn() !== 1) fail('Unable to safely create the friend request. Please try again.', 409);

    try {
        $state = relationship_for_users($viewerId, $targetId);
        if ($state['status'] === 'accepted') fail('You are already friends', 409);
        if ($state['status'] === 'pending') fail($state['direction'] === 'incoming' ? 'This user has already sent you a friend request' : 'Friend request already sent', 409);

        $insert = db()->prepare('INSERT INTO friend_requests (requester_id,recipient_id,status) VALUES (?, ?, "pending")');
        $insert->execute([$viewerId, $targetId]);
        $requestId = (int)db()->lastInsertId();

        queue_user_notification(
            $targetId,
            'system',
            'New friend request',
            ($viewer['name'] ?: 'A CloudComAI user') . ' sent you a friend request.',
            [
                'event' => 'friend_request',
                'request_id' => $requestId,
                'user_id' => $viewerId,
                'chat_type' => 'friend_request',
            ]
        );

        out(['request' => [
            'id' => $requestId,
            'status' => 'pending',
            'direction' => 'outgoing',
            'user_id' => $targetId,
        ]], 201);
    } finally {
        db()->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
    }
}

$requestId = (int)($input['request_id'] ?? 0);
if ($requestId <= 0) fail('Request id is required');

$requestStmt = db()->prepare('SELECT id,requester_id,recipient_id,status FROM friend_requests WHERE id=? LIMIT 1');
$requestStmt->execute([$requestId]);
$request = $requestStmt->fetch();
if (!$request) fail('Friend request not found', 404);

if ($action === 'accept' || $action === 'decline' || $action === 'block') {
    if ((int)$request['recipient_id'] !== $viewerId) fail('Only the recipient can respond to this friend request', 403);
    if ($request['status'] !== 'pending') fail('This friend request is no longer pending', 409);

    $requesterId = (int)$request['requester_id'];
    $requesterNameStmt = db()->prepare('SELECT name FROM users WHERE id=? LIMIT 1');
    $requesterNameStmt->execute([$requesterId]);
    $requesterName = (string)($requesterNameStmt->fetchColumn() ?: 'CloudComAI user');

    if ($action === 'accept') {
        $update = db()->prepare('UPDATE friend_requests SET status="accepted",responded_at=UTC_TIMESTAMP() WHERE id=? AND recipient_id=? AND status="pending"');
        $update->execute([$requestId, $viewerId]);
        if ($update->rowCount() !== 1) fail('This friend request is no longer pending', 409);
        queue_user_notification(
            $requesterId,
            'system',
            'Friend request accepted',
            ($viewer['name'] ?: 'CloudComAI user') . ' accepted your friend request.',
            ['event'=>'friend_request_accepted','request_id'=>$requestId,'user_id'=>$viewerId,'chat_type'=>'friend_request']
        );
        out(['relationship' => ['status' => 'accepted', 'direction' => 'incoming', 'request_id' => $requestId]]);
    }

    if ($action === 'decline') {
        $update = db()->prepare('UPDATE friend_requests SET status="declined",responded_at=UTC_TIMESTAMP() WHERE id=? AND recipient_id=? AND status="pending"');
        $update->execute([$requestId, $viewerId]);
        if ($update->rowCount() !== 1) fail('This friend request is no longer pending', 409);
        queue_user_notification(
            $requesterId,
            'system',
            'Friend request declined',
            ($viewer['name'] ?: 'CloudComAI user') . ' declined your friend request.',
            ['event'=>'friend_request_declined','request_id'=>$requestId,'user_id'=>$viewerId,'chat_type'=>'friend_request']
        );
        out(['relationship' => ['status' => 'declined', 'direction' => 'incoming', 'request_id' => $requestId]]);
    }

    db()->beginTransaction();
    try {
        $block = db()->prepare('INSERT IGNORE INTO user_blocks (user_id,blocked_user_id) VALUES (?,?)');
        $block->execute([$viewerId, $requesterId]);
        $update = db()->prepare('UPDATE friend_requests SET status="blocked",responded_at=UTC_TIMESTAMP() WHERE id=? AND recipient_id=? AND status="pending"');
        $update->execute([$requestId, $viewerId]);
        if ($update->rowCount() !== 1) throw new RuntimeException('This friend request is no longer pending');
        db()->commit();
    } catch (Throwable $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
    out(['relationship' => ['status' => 'blocked', 'direction' => 'incoming', 'request_id' => $requestId]]);
}

if ($action === 'cancel') {
    if ((int)$request['requester_id'] !== $viewerId) fail('Only the requester can cancel this friend request', 403);
    if ($request['status'] !== 'pending') fail('This friend request is no longer pending', 409);
    db()->prepare('UPDATE friend_requests SET status="cancelled",responded_at=UTC_TIMESTAMP() WHERE id=? AND requester_id=? AND status="pending"')->execute([$requestId, $viewerId]);
    out(['relationship' => ['status' => 'cancelled', 'direction' => 'outgoing', 'request_id' => $requestId]]);
}

fail('Unsupported friend request action', 400);

function relationship_for_users(int $viewerId, int $targetId): array {
    $stmt = db()->prepare('
        SELECT id,status,requester_id,recipient_id
        FROM friend_requests
        WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)
        ORDER BY id DESC
        LIMIT 1
    ');
    $stmt->execute([$viewerId,$targetId,$targetId,$viewerId]);
    $row = $stmt->fetch();
    if (!$row) return ['status' => 'none'];
    return [
        'status' => (string)$row['status'],
        'direction' => (int)$row['requester_id'] === $viewerId ? 'outgoing' : 'incoming',
        'request_id' => (int)$row['id'],
    ];
}
