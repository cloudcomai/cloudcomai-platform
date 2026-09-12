<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $st = $pdo->prepare("
            SELECT
                c.id,
                c.name,
                c.retention_seconds,
                c.created_at,
                CASE WHEN cm.status='active' THEN 1 ELSE 0 END AS joined,
                (
                    SELECT COUNT(*)
                    FROM chat_members count_members
                    WHERE count_members.chat_id=c.id
                      AND count_members.status='active'
                ) AS joined_count,
                (
                    SELECT COUNT(*)
                    FROM chat_members online_members
                    INNER JOIN users online_users ON online_users.id=online_members.user_id
                    LEFT JOIN user_privacy_settings online_privacy ON online_privacy.user_id=online_users.id
                    WHERE online_members.chat_id=c.id
                      AND online_members.status='active'
                      AND online_users.account_status='active'
                      AND online_users.updated_at IS NOT NULL
                      AND online_users.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND
                      AND COALESCE(online_privacy.hide_online_status,0)=0
                ) AS online_count
            FROM chats c
            LEFT JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=?
            WHERE c.type='public' AND c.group_category='india-city'
            ORDER BY c.name ASC
            LIMIT 50
        ");
        $st->execute([$user['id']]);
        $rooms = array_map(static fn(array $room): array => [
            'id'=>(int)$room['id'],
            'name'=>$room['name'],
            'type'=>'public',
            'isPublic'=>true,
            'joined'=>(bool)$room['joined'],
            'joined_count'=>(int)$room['joined_count'],
            'online_count'=>(int)$room['online_count'],
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
    $roomId=(int)(input()['room_id'] ?? 0);
    if ($roomId<=0) fail('A valid public chat room is required',422);

    $roomQuery=$pdo->prepare("SELECT id,name,retention_seconds FROM chats WHERE id=? AND type='public' AND group_category='india-city' LIMIT 1");
    $roomQuery->execute([$roomId]);
    $room=$roomQuery->fetch();
    if (!$room) fail('Public chat room not found',404);

    try {
        $pdo->beginTransaction();
        $pdo->prepare("
            INSERT INTO chat_members(chat_id,user_id,role,status,joined_at)
            VALUES(?,?,'member','active',UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE status='active',joined_at=COALESCE(joined_at,UTC_TIMESTAMP())
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

if ($method === 'DELETE') {
    $roomId=(int)($_GET['id'] ?? 0);
    if ($roomId<=0) fail('A valid public chat room is required',422);

    $membership=$pdo->prepare("
        SELECT c.id
        FROM chats c
        INNER JOIN chat_members cm ON cm.chat_id=c.id
        WHERE c.id=?
          AND c.type='public'
          AND c.group_category='india-city'
          AND cm.user_id=?
          AND cm.status='active'
        LIMIT 1
    ");
    $membership->execute([$roomId,$user['id']]);
    if (!$membership->fetch()) fail('Public chat room not found or you are not a member',404);

    try {
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE chat_members SET status='left' WHERE chat_id=? AND user_id=? AND status='active'")->execute([$roomId,$user['id']]);
        $pdo->prepare("UPDATE chat_user_states SET hidden=1,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?")->execute([$roomId,$user['id']]);
        $pdo->commit();
        out([
            'message'=>'You left the public chat room',
            'chat_id'=>$roomId,
            'status'=>'left',
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('public_chats.php DELETE error: '.$e->getMessage());
        fail('Unable to leave public chat room',500);
    }
}

fail('Method not allowed',405);
