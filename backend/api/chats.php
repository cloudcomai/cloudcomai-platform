<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $type = trim((string)($_GET['type'] ?? ''));

    $sql = '
        SELECT
            c.id,
            c.type,
            c.name,
            c.group_category,
            c.owner_id,
            c.retention_seconds,
            c.created_at,
            MAX(m.created_at) AS last_message_at
        FROM chats c
        INNER JOIN chat_members cm ON cm.chat_id = c.id
        LEFT JOIN chat_user_states cus ON cus.chat_id = c.id AND cus.user_id = cm.user_id
        LEFT JOIN messages m ON m.chat_id = c.id
          AND m.id > COALESCE(cus.cleared_through_message_id, 0)
          AND m.deleted_for_everyone = 0
          AND (m.expires_at IS NULL OR m.expires_at > UTC_TIMESTAMP())
        WHERE cm.user_id = ?
          AND cm.status = "active"
          AND (COALESCE(cus.hidden, 0) = 0 OR m.id IS NOT NULL)
    ';

    $params = [$user['id']];
    if ($type !== '') {
        if (!in_array($type, ['private', 'group', 'public', 'community'], true)) fail('Invalid chat type');
        $sql .= ' AND c.type = ?';
        $params[] = $type;
    }

    $sql .= '
        GROUP BY c.id, c.type, c.name, c.group_category, c.owner_id, c.retention_seconds, c.created_at, cus.hidden
        ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC
    ';

    try {
        $st = $pdo->prepare($sql);
        $st->execute($params);
        $chats = $st->fetchAll();

        foreach ($chats as &$chat) {
            $chat['id'] = (int)$chat['id'];
            $chat['owner_id'] = $chat['owner_id'] !== null ? (int)$chat['owner_id'] : null;
            $chat['isGroup'] = $chat['type'] === 'group';

            if ($chat['type'] === 'private') {
                $other = $pdo->prepare('
                    SELECT u.id, u.name, u.user_id, u.updated_at,
                           CASE WHEN u.updated_at IS NOT NULL AND u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND THEN 1 ELSE 0 END AS online
                    FROM chat_members cm
                    INNER JOIN users u ON u.id = cm.user_id
                    WHERE cm.chat_id = ?
                      AND cm.user_id <> ?
                      AND cm.status = "active"
                    ORDER BY u.id ASC
                    LIMIT 1
                ');
                $other->execute([$chat['id'], $user['id']]);
                $participant = $other->fetch();
                if ($participant) {
                    $chat['other_user_id'] = (int)$participant['id'];
                    $chat['other_user_name'] = $participant['name'];
                    $chat['other_user_id_text'] = $participant['user_id'];
                    $chat['name'] = $participant['name'];
                    $chat['online'] = (bool)$participant['online'];
                    $chat['other_user_online'] = (bool)$participant['online'];
                }
            }
        }
        unset($chat);

        out(['chats' => $chats]);
    } catch (Throwable $e) {
        error_log('chats.php GET error: ' . $e->getMessage());
        fail('Unable to load chats', 500);
    }
}

if ($method === 'POST') {
    $d = input();
    $type = (string)($d['type'] ?? '');
    if ($type !== 'private') fail('Unsupported chat creation type');

    $targetUserId = (int)($d['target_user_id'] ?? 0);
    if ($targetUserId <= 0 || $targetUserId === (int)$user['id']) fail('A valid target user is required');

    try {
        $target = $pdo->prepare('SELECT id, name, user_id, account_status, updated_at, CASE WHEN updated_at IS NOT NULL AND updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND THEN 1 ELSE 0 END AS online FROM users WHERE id=? LIMIT 1');
        $target->execute([$targetUserId]);
        $targetUser = $target->fetch();
        if (!$targetUser || $targetUser['account_status'] !== 'active') fail('Target user is unavailable', 404);

        $existing = $pdo->prepare('
            SELECT c.id
            FROM chats c
            INNER JOIN chat_members a ON a.chat_id=c.id AND a.user_id=? AND a.status="active"
            INNER JOIN chat_members b ON b.chat_id=c.id AND b.user_id=? AND b.status="active"
            WHERE c.type="private"
            LIMIT 1
        ');
        $existing->execute([$user['id'], $targetUserId]);
        $chat = $existing->fetch();

        if (!$chat) {
            $pdo->beginTransaction();
            $insert = $pdo->prepare('INSERT INTO chats(type,name,owner_id,created_at) VALUES("private",NULL,?,UTC_TIMESTAMP())');
            $insert->execute([$user['id']]);
            $chatId = (int)$pdo->lastInsertId();
            $member = $pdo->prepare('INSERT INTO chat_members(chat_id,user_id,role,status,joined_at) VALUES(?,?,"member","active",UTC_TIMESTAMP())');
            $member->execute([$chatId, $user['id']]);
            $member->execute([$chatId, $targetUserId]);
            $pdo->commit();
        } else {
            $chatId = (int)$chat['id'];
        }

        $pdo->prepare('
            INSERT INTO chat_user_states(chat_id,user_id,hidden,cleared_through_message_id,updated_at)
            VALUES(?,?,0,0,UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE hidden=0, updated_at=UTC_TIMESTAMP()
        ')->execute([$chatId, $user['id']]);

        out(['chat' => [
            'id' => $chatId,
            'type' => 'private',
            'name' => $targetUser['name'],
            'owner_id' => (int)$user['id'],
            'other_user_id' => (int)$targetUser['id'],
            'other_user_name' => $targetUser['name'],
            'other_user_id_text' => $targetUser['user_id'],
            'online' => (bool)$targetUser['online'],
            'other_user_online' => (bool)$targetUser['online']
        ]], $chat ? 200 : 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('chats.php POST error: ' . $e->getMessage());
        fail('Unable to create private chat', 500);
    }
}

if ($method === 'DELETE') {
    $chatId = (int)($_GET['id'] ?? 0);
    if ($chatId <= 0) fail('Chat id is required');

    $member = $pdo->prepare('
        SELECT c.id
        FROM chats c
        INNER JOIN chat_members cm ON cm.chat_id=c.id
        WHERE c.id=? AND c.type="private" AND cm.user_id=? AND cm.status="active"
        LIMIT 1
    ');
    $member->execute([$chatId, $user['id']]);
    if (!$member->fetch()) fail('Private chat not found', 404);

    try {
        $pdo->beginTransaction();
        $latest = $pdo->prepare('SELECT COALESCE(MAX(id),0) FROM messages WHERE chat_id=?');
        $latest->execute([$chatId]);
        $clearedThrough = (int)$latest->fetchColumn();
        $state = $pdo->prepare('
            INSERT INTO chat_user_states(chat_id,user_id,hidden,cleared_through_message_id,updated_at)
            VALUES(?,?,1,?,UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE
                hidden=1,
                cleared_through_message_id=GREATEST(cleared_through_message_id,VALUES(cleared_through_message_id)),
                updated_at=UTC_TIMESTAMP()
        ');
        $state->execute([$chatId, $user['id'], $clearedThrough]);
        $deleteDeliveries = $pdo->prepare('
            DELETE q
            FROM notification_delivery_queue q
            INNER JOIN notification_history n ON n.id=q.notification_id
            WHERE n.user_id=?
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(n.data_json,"$.chat_id")) AS UNSIGNED)=?
        ');
        $deleteDeliveries->execute([$user['id'], $chatId]);
        $deleteNotifications = $pdo->prepare('
            DELETE FROM notification_history
            WHERE user_id=?
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.chat_id")) AS UNSIGNED)=?
        ');
        $deleteNotifications->execute([$user['id'], $chatId]);
        $pdo->commit();
        out([
            'message' => 'Chat deleted from your account',
            'chat_id' => $chatId,
            'scope' => 'current_user',
            'cleared_through_message_id' => $clearedThrough,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('chats.php DELETE error: ' . $e->getMessage());
        fail('Unable to delete chat', 500);
    }
}

fail('Method not allowed', 405);
