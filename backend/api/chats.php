<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $type = trim((string)($_GET['type'] ?? ''));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(20, max(1, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

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
            CASE WHEN c.type = "private" THEN other_user.id ELSE NULL END AS other_user_id,
            CASE WHEN c.type = "private" THEN other_user.name ELSE NULL END AS other_user_name,
            CASE WHEN c.type = "private" THEN other_user.user_id ELSE NULL END AS other_user_id_text,
            CASE WHEN c.type = "private"
                 THEN CASE WHEN other_user.updated_at IS NOT NULL
                              AND other_user.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND
                              AND COALESCE(other_privacy.hide_online_status,0)=0
                              AND blocked_by_me.user_id IS NULL
                              AND blocked_me.user_id IS NULL
                           THEN 1 ELSE 0 END
                 ELSE 0 END AS online,
            CASE WHEN c.type = "private" AND blocked_by_me.user_id IS NULL THEN 0 ELSE CASE WHEN c.type = "private" THEN 1 ELSE 0 END END AS blocked_by_me,
            CASE WHEN c.type = "private" AND blocked_me.user_id IS NULL THEN 0 ELSE CASE WHEN c.type = "private" THEN 1 ELSE 0 END END AS blocked_me,
            (
                SELECT MAX(m.created_at)
                FROM messages m
                LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=cm.user_id
                WHERE m.chat_id=c.id
                  AND m.id > COALESCE(cus.cleared_through_message_id,0)
                  AND m.deleted_for_everyone=0
                  AND COALESCE(mus.hidden,0)=0
                  AND (m.expires_at IS NULL OR m.expires_at > UTC_TIMESTAMP())
            ) AS last_message_at,
            (
                SELECT COUNT(*)
                FROM messages um
                LEFT JOIN message_user_states umus ON umus.message_id=um.id AND umus.user_id=cm.user_id
                WHERE um.chat_id=c.id
                  AND um.id > GREATEST(COALESCE(cus.last_read_message_id,0), COALESCE(cus.cleared_through_message_id,0))
                  AND um.sender_id <> cm.user_id
                  AND um.deleted_for_everyone=0
                  AND COALESCE(umus.hidden,0)=0
                  AND (um.expires_at IS NULL OR um.expires_at > UTC_TIMESTAMP())
            ) AS unread
        FROM chats c
        INNER JOIN chat_members cm ON cm.chat_id=c.id
        LEFT JOIN chat_user_states cus ON cus.chat_id=c.id AND cus.user_id=cm.user_id
        LEFT JOIN chat_members other_cm
          ON c.type="private"
         AND other_cm.chat_id=c.id
         AND other_cm.user_id<>cm.user_id
         AND other_cm.status="active"
        LEFT JOIN users other_user ON other_user.id=other_cm.user_id
        LEFT JOIN user_privacy_settings other_privacy ON other_privacy.user_id=other_user.id
        LEFT JOIN user_blocks blocked_by_me ON blocked_by_me.user_id=cm.user_id AND blocked_by_me.blocked_user_id=other_user.id
        LEFT JOIN user_blocks blocked_me ON blocked_me.user_id=other_user.id AND blocked_me.blocked_user_id=cm.user_id
        WHERE cm.user_id = ?
          AND cm.status = "active"
          AND (COALESCE(cus.hidden,0) = 0 OR EXISTS (
              SELECT 1
              FROM messages hm
              LEFT JOIN message_user_states hmus ON hmus.message_id=hm.id AND hmus.user_id=cm.user_id
              WHERE hm.chat_id=c.id
                AND hm.id > COALESCE(cus.cleared_through_message_id,0)
                AND hm.deleted_for_everyone=0
                AND COALESCE(hmus.hidden,0)=0
                AND (hm.expires_at IS NULL OR hm.expires_at > UTC_TIMESTAMP())
          ))
          AND (c.type <> "private" OR EXISTS (
              SELECT 1
              FROM messages pm
              LEFT JOIN message_user_states pmus ON pmus.message_id=pm.id AND pmus.user_id=cm.user_id
              WHERE pm.chat_id=c.id
                AND pm.id > COALESCE(cus.cleared_through_message_id,0)
                AND pm.deleted_for_everyone=0
                AND COALESCE(pmus.hidden,0)=0
                AND (pm.expires_at IS NULL OR pm.expires_at > UTC_TIMESTAMP())
          ))
    ';

    $params = [$user['id']];
    if ($type !== '') {
        if (!in_array($type, ['private', 'group', 'public', 'community'], true)) fail('Invalid chat type');
        $sql .= ' AND c.type = ?';
        $params[] = $type;
    }

    $sql .= '
        ORDER BY COALESCE(last_message_at, c.created_at) DESC, c.id DESC
        LIMIT ? OFFSET ?
    ';

    $params[] = $limit + 1;
    $params[] = $offset;

    try {
        $st = $pdo->prepare($sql);
        $st->execute($params);
        $chats = $st->fetchAll();
        $hasMore = count($chats) > $limit;
        if ($hasMore) array_pop($chats);

        foreach ($chats as &$chat) {
            $chat['id'] = (int)$chat['id'];
            $chat['owner_id'] = $chat['owner_id'] !== null ? (int)$chat['owner_id'] : null;
            $chat['isGroup'] = $chat['type'] === 'group';
            $chat['unread'] = (int)($chat['unread'] ?? 0);
            $chat['notifications_muted'] = (bool)($chat['notifications_muted'] ?? false);
            $chat['image_version'] = null;

            if ($chat['type'] === 'private') {
                $chat['other_user_id'] = $chat['other_user_id'] !== null ? (int)$chat['other_user_id'] : null;
                $chat['name'] = $chat['other_user_name'] ?: $chat['name'];
                $chat['online'] = (bool)$chat['online'];
                $chat['other_user_online'] = (bool)$chat['online'];
                $chat['blocked_by_me'] = (bool)$chat['blocked_by_me'];
                $chat['blocked_me'] = (bool)$chat['blocked_me'];
                $chat['blocked'] = $chat['blocked_by_me'] || $chat['blocked_me'];
                $imageFolder = dirname(__DIR__) . '/uploads/users';
                $imageId = (int)($chat['other_user_id'] ?? 0);
            } else {
                $imageFolder = dirname(__DIR__) . '/uploads/groups';
                $imageId = (int)$chat['id'];
            }

            if ($imageId > 0) {
                foreach (glob($imageFolder . '/' . $imageId . '.*') ?: [] as $candidate) {
                    if (is_file($candidate)) {
                        $chat['image_version'] = (string)(filemtime($candidate) ?: 0) . '-' . (string)filesize($candidate);
                        break;
                    }
                }
            }
        }
        unset($chat);

        out(['chats' => $chats, 'pagination' => ['page' => $page, 'limit' => $limit, 'has_more' => $hasMore]]);
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
            'image_version' => null
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
