<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $st = $pdo->prepare("
            SELECT c.id,c.name,c.retention_seconds,c.created_at,
                   CASE WHEN cm.status='active' THEN 1 ELSE 0 END AS joined,
                   (
                       SELECT COUNT(*)
                       FROM chat_members online_cm
                       INNER JOIN users online_u ON online_u.id=online_cm.user_id
                       LEFT JOIN user_privacy_settings online_ups ON online_ups.user_id=online_cm.user_id
                       WHERE online_cm.chat_id=c.id
                         AND online_cm.status='active'
                         AND online_u.updated_at IS NOT NULL
                         AND online_u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND
                         AND COALESCE(online_ups.hide_online_status,0)=0
                   ) AS online_users,
                   (
                       SELECT COUNT(*)
                       FROM messages room_m
                       WHERE room_m.chat_id=c.id
                         AND room_m.deleted_for_everyone=0
                         AND (room_m.expires_at IS NULL OR room_m.expires_at > UTC_TIMESTAMP())
                   ) AS total_messages
            FROM chats c
            LEFT JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=?
            WHERE c.type='public' AND c.group_category='india-city'
            ORDER BY CASE WHEN cm.status='active' THEN 0 ELSE 1 END, c.name ASC
            LIMIT 50
        ");
        $st->execute([$user['id']]);
        $rooms = array_map(static fn(array $room): array => [
            'id'=>(int)$room['id'],
            'name'=>$room['name'],
            'type'=>'public',
            'isPublic'=>true,
            'joined'=>(bool)$room['joined'],
            'online_users'=>(int)$room['online_users'],
            'total_messages'=>(int)$room['total_messages'],
            'retention_seconds'=>$room['retention_seconds'] !== null ? (int)$room['retention_seconds'] : null,
            'created_at'=>$room['created_at'],
        ], $st->fetchAll());
        out(['rooms'=>$rooms]);
    } catch (Throwable $e) {
        error_log('public_chats.php GET error: '.$e->getMessage());
        fail('Unable to load public chat rooms',500);
    }
}

if ($method === 'POST') {
    $data = input();
    $action = strtolower(trim((string)($data['action'] ?? 'join')));
    $roomId=(int)($data['room_id'] ?? 0);
    if ($roomId<=0) fail('A valid public chat room is required',422);

    $roomQuery=$pdo->prepare("SELECT id,name,retention_seconds FROM chats WHERE id=? AND type='public' AND group_category='india-city' LIMIT 1");
    $roomQuery->execute([$roomId]);
    $room=$roomQuery->fetch();
    if (!$room) fail('Public chat room not found',404);

    if ($action === 'leave') {
        try {
            $pdo->beginTransaction();
            $member = $pdo->prepare("SELECT status FROM chat_members WHERE chat_id=? AND user_id=? LIMIT 1");
            $member->execute([$roomId,$user['id']]);
            $membership = $member->fetch();
            if (!$membership || $membership['status'] !== 'active') {
                $pdo->rollBack();
                out(['message'=>'You are not currently joined to this public chat room','left'=>false]);
            }

            $pdo->prepare("UPDATE chat_members SET status='removed' WHERE chat_id=? AND user_id=? AND status='active'")->execute([$roomId,$user['id']]);
            $pdo->prepare("
                INSERT INTO chat_user_states(chat_id,user_id,hidden,cleared_through_message_id,updated_at)
                VALUES(?,?,1,0,UTC_TIMESTAMP())
                ON DUPLICATE KEY UPDATE hidden=1,updated_at=UTC_TIMESTAMP()
            ")->execute([$roomId,$user['id']]);
            $pdo->commit();
            out(['message'=>'Left public chat room','left'=>true,'room_id'=>$roomId]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('public_chats.php leave error: '.$e->getMessage());
            fail('Unable to leave public chat room',500);
        }
    }

    if ($action !== 'join') fail('Unsupported public chat action',422);

    try {
        $pdo->beginTransaction();
        $pdo->prepare("
            INSERT INTO chat_members(chat_id,user_id,role,status,joined_at)
            VALUES(?,?,'member','active',UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE status='active',joined_at=UTC_TIMESTAMP()
        ")->execute([$roomId,$user['id']]);
        $pdo->prepare("
            INSERT INTO chat_user_states(chat_id,user_id,hidden,cleared_through_message_id,updated_at)
            VALUES(?,?,0,0,UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE hidden=0,updated_at=UTC_TIMESTAMP()
        ")->execute([$roomId,$user['id']]);
        $pdo->commit();

        out(['chat'=>[
            'id'=>$roomId,
            'type'=>'public',
            'name'=>$room['name'],
            'isPublic'=>true,
            'retention_seconds'=>$room['retention_seconds'] !== null ? (int)$room['retention_seconds'] : null,
        ]]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('public_chats.php POST error: '.$e->getMessage());
        fail('Unable to join public chat room',500);
    }
}

fail('Method not allowed',405);
