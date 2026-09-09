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
            COALESCE(cus.notifications_muted,0) AS notifications_muted,
            COALESCE(cus.last_read_message_id,0) AS last_read_message_id,
            SUM(CASE WHEN m.id > COALESCE(cus.last_read_message_id,0) AND m.sender_id <> cm.user_id THEN 1 ELSE 0 END) AS unread,
            MAX(m.created_at) AS last_message_at
        FROM chats c
        INNER JOIN chat_members cm ON cm.chat_id = c.id
        LEFT JOIN chat_user_states cus ON cus.chat_id = c.id AND cus.user_id = cm.user_id
        LEFT JOIN messages m ON m.chat_id = c.id
          AND m.id > COALESCE(cus.cleared_through_message_id, 0)
          AND m.deleted_for_everyone = 0
          AND NOT EXISTS (SELECT 1 FROM message_user_states mus WHERE mus.message_id=m.id AND mus.user_id=cm.user_id AND mus.hidden=1)
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
        GROUP BY c.id, c.type, c.name, c.group_category, c.owner_id, c.retention_seconds, c.created_at, cus.hidden, cus.notifications_muted, cus.last_read_message_id
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
            $chat['unread'] = (int)($chat['unread'] ?? 0);
            $chat['notifications_muted'] = (bool)($chat['notifications_muted'] ?? false);
            $chat['image_version'] = null;
            $imageFolder = dirname(__DIR__) . '/uploads/' . ($chat['type'] === 'group' ? 'groups' : 'users');
            $imageId = (int)$chat['id'];

            if ($chat['type'] === 'private') {
                $other = $pdo->prepare('
                    SELECT u.id, u.name, u.user_id, u.updated_at,
                           CASE WHEN u.updated_at IS NOT NULL
                                  AND u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND
                                  AND COALESCE(ups.hide_online_status,0)=0
                                  AND blocked_by_me.user_id IS NULL
                                  AND blocked_me.user_id IS NULL
                                THEN 1 ELSE 0 END AS online,
                           CASE WHEN blocked_by_me.user_id IS NULL THEN 0 ELSE 1 END AS blocked_by_me,
                           CASE WHEN blocked_me.user_id IS NULL THEN 0 ELSE 1 END AS blocked_me
                    FROM chat_members cm
                    INNER JOIN users u ON u.id = cm.user_id
                    LEFT JOIN user_privacy_settings ups ON ups.user_id=u.id
                    LEFT JOIN user_blocks blocked_by_me ON blocked_by_me.user_id=? AND blocked_by_me.blocked_user_id=u.id
                    LEFT JOIN user_blocks blocked_me ON blocked_me.user_id=u.id AND blocked_me.blocked_user_id=?
                    WHERE cm.chat_id = ?
                      AND cm.user_id <> ?
                      AND cm.status = "active"
                    ORDER BY u.id ASC
                    LIMIT 1
                ');
                $other->execute([$user['id'], $user['id'], $chat['id'], $user['id']]);
                $participant = $other->fetch();
                if ($participant) {
                    $chat['other_user_id'] = (int)$participant['id'];
                    $chat['other_user_name'] = $participant['name'];
                    $chat['other_user_id_text'] = $participant['user_id'];
                    $chat['name'] = $participant['name'];
                    $chat['online'] = (bool)$participant['online'];
                    $chat['other_user_online'] = (bool)$participant['online'];
                    $chat['blocked_by_me'] = (bool)$participant['blocked_by_me'];
                    $chat['blocked_me'] = (bool)$participant['blocked_me'];
                    $chat['blocked'] = $chat['blocked_by_me'] || $chat['blocked_me'];
                    $imageId = (int)$participant['id'];
                    $imageFolder = dirname(__DIR__) . '/uploads/users';
                }
            } elseif ($chat['type'] !== 'group') {
                $imageId = (int)$chat['id'];
                $imageFolder = dirname(__DIR__) . '/uploads/' . $chat['type'];
            }

            foreach (glob($imageFolder . '/' . $imageId . '.*') ?: [] as $candidate) {
                if (is_file($candidate)) {
                    $chat['image_version'] = (string)(filemtime($candidate) ?: 0) . '-' . (string)filesize($candidate);
                    break;
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
        if (users_block_state((int)$user['id'], $targetUserId)['blocked']) fail('This contact is blocked', 403);
        $target = $pdo->prepare('SELECT u.id,u.name,u.user_id,u.account_status,u.updated_at,CASE WHEN u.updated_at IS NOT NULL AND u.updated_at>=UTC_TIMESTAMP()-INTERVAL 90 SECOND AND COALESCE(ups.hide_online_status,0)=0 THEN 1 ELSE 0 END AS online FROM users u LEFT JOIN user_privacy_settings ups ON ups.user_id=u.id WHERE u.id=? LIMIT 1');
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
            $retention = chat_retention_seconds('private');
            $insert = $pdo->prepare('INSERT INTO chats(type,name,owner_id,retention_seconds,created_at) VALUES("private",NULL,?,?,UTC_TIMESTAMP())');
            $insert->execute([$user['id'], $retention]);
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
            'other_user_online' => (bool)$targetUser['online'],
            'image_version' => null,
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
