<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $st = $pdo->prepare('
            SELECT c.id, c.name, c.retention_seconds, c.created_at,
                   CASE WHEN cm.status="active" THEN 1 ELSE 0 END AS joined
            FROM chats c
            LEFT JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=?
            WHERE c.type="public" AND c.group_category="india-city"
            ORDER BY c.name ASC
        ');
        $st->execute([$user['id']]);
        $rooms = [];
        foreach ($st->fetchAll() as $room) {
            $rooms[] = [
                'id' => (int)$room['id'],
                'name' => $room['name'],
                'type' => 'public',
                'joined' => (bool)$room['joined'],
                'retention_seconds' => $room['retention_seconds'] !== null ? (int)$room['retention_seconds'] : null,
                'created_at' => $room['created_at'],
            ];
        }
        out(['rooms' => $rooms]);
    } catch (Throwable $e) {
        error_log('public_chats.php GET error: ' . $e->getMessage());
        fail('Unable to load public chat rooms', 500);
    }
}

if ($method === 'POST') {
    $data = input();
    $roomId = (int)($data['room_id'] ?? 0);
    if ($roomId <= 0) fail('A valid public chat room is required');

    try {
        $roomQuery = $pdo->prepare('SELECT id,name,retention_seconds FROM chats WHERE id=? AND type="public" AND group_category="india-city" LIMIT 1');
        $roomQuery->execute([$roomId]);
        $room = $roomQuery->fetch();
        if (!$room) fail('Public chat room not found', 404);

        $pdo->beginTransaction();
        $member = $pdo->prepare('
            INSERT INTO chat_members(chat_id,user_id,role,status,joined_at)
            VALUES(?,?,"member","active",UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE status="active", joined_at=COALESCE(joined_at,UTC_TIMESTAMP())
        ');
        $member->execute([$roomId, $user['id']]);
        $state = $pdo->prepare('
            INSERT INTO chat_user_states(chat_id,user_id,hidden,cleared_through_message_id,updated_at)
            VALUES(?,?,0,0,UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE hidden=0, updated_at=UTC_TIMESTAMP()
        ');
        $state->execute([$roomId, $user['id']]);
        $pdo->commit();

        out(['chat' => [
            'id' => $roomId,
            'type' => 'public',
            'name' => $room['name'],
            'isPublic' => true,
            'retention_seconds' => $room['retention_seconds'] !== null ? (int)$room['retention_seconds'] : null,
        ]]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('public_chats.php POST error: ' . $e->getMessage());
        fail('Unable to join public chat room', 500);
    }
}

fail('Method not allowed', 405);
