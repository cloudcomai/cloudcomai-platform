<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];

function hydrate_message_attachments(array &$messages): void {
    if (!$messages) return;
    $ids = array_values(array_filter(array_map(fn($message) => (int)($message['id'] ?? 0), $messages)));
    if (!$ids) return;
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $st = db()->prepare("SELECT id,message_id,original_filename,mime_type,file_size,download_policy FROM message_attachments WHERE message_id IN ($placeholders) ORDER BY id ASC");
    $st->execute($ids);
    $attachments = [];
    foreach ($st->fetchAll() as $attachment) {
        $attachments[(int)$attachment['message_id']][] = [
            'id' => (int)$attachment['id'],
            'name' => $attachment['original_filename'],
            'mime_type' => $attachment['mime_type'],
            'file_size' => (int)$attachment['file_size'],
            'download_policy' => $attachment['download_policy'],
        ];
    }
    foreach ($messages as &$message) {
        $messageAttachments = $attachments[(int)$message['id']] ?? [];
        $message['attachments'] = $messageAttachments;
        $message['attachment'] = $messageAttachments[0] ?? null;
    }
    unset($message);
}

function hydrate_message_polls(array &$messages, int $userId): void {
    $pollQuery = db()->prepare('SELECT p.id,p.question,po.id AS option_id,po.option_text,po.display_order,COUNT(pv.user_id) AS votes,MAX(CASE WHEN pv.user_id=? THEN 1 ELSE 0 END) AS selected FROM polls p INNER JOIN poll_options po ON po.poll_id=p.id LEFT JOIN poll_votes pv ON pv.option_id=po.id AND pv.poll_id=p.id WHERE p.id=? GROUP BY p.id,p.question,po.id,po.option_text,po.display_order ORDER BY po.display_order ASC,po.id ASC');
    foreach ($messages as &$message) {
        if ($message['type'] !== 'poll') continue;
        $meta = json_decode((string)$message['body'], true);
        $pollId = (int)($meta['poll_id'] ?? 0);
        if ($pollId <= 0) continue;
        $pollQuery->execute([$userId, $pollId]);
        $rows = $pollQuery->fetchAll();
        if (!$rows) continue;
        $options = [];
        foreach ($rows as $row) $options[] = ['id'=>(int)$row['option_id'],'text'=>$row['option_text'],'votes'=>(int)$row['votes'],'selected'=>(bool)$row['selected']];
        $message['poll_id'] = $pollId;
        $message['poll'] = ['id'=>$pollId,'question'=>$rows[0]['question'],'options'=>$options];
    }
    unset($message);
}

if ($method === 'GET') {
    $chatId = (int)($_GET['chat_id'] ?? 0);
    $after = (int)($_GET['after_id'] ?? 0);
    $requestedAfter = $after;
    $syncFrom = max(1, (int)($_GET['sync_from_id'] ?? 1));
    $since = (string)($_GET['updated_after'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $since)) $since = gmdate('Y-m-d H:i:s');
    $syncedAt = gmdate('Y-m-d H:i:s');
    $search = trim((string)($_GET['q'] ?? ''));
    if ($chatId <= 0) fail('Chat id is required');
    if (strlen($search) > 120) $search = substr($search, 0, 120);

    $membershipQuery = db()->prepare('SELECT COALESCE(cus.cleared_through_message_id,0) AS cleared_through_message_id FROM chat_members cm LEFT JOIN chat_user_states cus ON cus.chat_id=cm.chat_id AND cus.user_id=cm.user_id WHERE cm.chat_id=? AND cm.user_id=? AND cm.status="active"');
    $membershipQuery->execute([$chatId, $user['id']]);
    $membership = $membershipQuery->fetch();
    if (!$membership) fail('Not a member', 403);
    $clearedThrough = (int)$membership['cleared_through_message_id'];
    $after = max($after, $clearedThrough);

    $sql = <<<'SQL'
        SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.reply_to_message_id,m.edit_count,m.edited_at,m.created_at,
               u.name AS sender_name,
               CASE WHEN COALESCE(rus.hidden,0)=0 THEN r.body ELSE NULL END AS reply_to_text,
               CASE WHEN COALESCE(rus.hidden,0)=0 THEN ru.name ELSE NULL END AS reply_to_sender_name
        FROM messages m
        INNER JOIN users u ON u.id=m.sender_id
        LEFT JOIN messages r ON r.id=m.reply_to_message_id AND r.id>? AND r.deleted_for_everyone=0 AND (r.expires_at IS NULL OR r.expires_at>UTC_TIMESTAMP())
        LEFT JOIN users ru ON ru.id=r.sender_id
        LEFT JOIN message_user_states rus ON rus.message_id=r.id AND rus.user_id=?
        LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=?
        WHERE m.chat_id=? AND m.id>? AND m.deleted_for_everyone=0
          AND COALESCE(mus.hidden,0)=0
          AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())
    SQL;
    $params = [$clearedThrough, $user['id'], $user['id'], $chatId, $after];
    if ($search !== '') {
        $sql .= ' AND (m.body LIKE ? OR EXISTS (SELECT 1 FROM message_attachments ma WHERE ma.message_id=m.id AND ma.original_filename LIKE ?))';
        $like = '%' . $search . '%';
        $params[] = $like;
        $params[] = $like;
        $sql .= ' ORDER BY m.id DESC LIMIT 100';
    } else {
        $sql .= ' ORDER BY m.id ASC LIMIT 200';
    }
    $st = db()->prepare($sql);
    $st->execute($params);
    $messages = $st->fetchAll();
    if ($search !== '') $messages = array_reverse($messages);
    $removedIds = [];
    if ($search === '' && $requestedAfter > 0) {
        // Synchronize edits separately so they cannot consume the new-message page.
        $updatesSql = str_replace('m.id>? AND m.deleted_for_everyone=0', 'm.id>? AND m.id<=? AND m.edited_at>=? AND m.deleted_for_everyone=0', $sql);
        $updates = db()->prepare(str_replace(' LIMIT 200', '', $updatesSql));
        $updates->execute([$clearedThrough,$user['id'],$user['id'],$chatId,max($clearedThrough,$syncFrom-1),$requestedAfter,$since]);
        $messages = array_merge($updates->fetchAll(), $messages);
        $removed = db()->prepare('SELECT m.id FROM messages m LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=? WHERE m.chat_id=? AND m.id>=? AND m.id<=? AND (m.deleted_for_everyone=1 OR COALESCE(mus.hidden,0)=1 OR m.id<=? OR m.expires_at<=UTC_TIMESTAMP())');
        $removed->execute([$user['id'],$chatId,$syncFrom,$requestedAfter,$clearedThrough]);
        $removedIds = array_map('intval', $removed->fetchAll(PDO::FETCH_COLUMN));
    }
    hydrate_message_attachments($messages);
    hydrate_message_polls($messages, (int)$user['id']);
    $screenshotAlerts = [];
    if ($search === '' && user_privacy_settings((int)$user['id'])['screenshot_alerts']) {
        $alerts = db()->prepare('SELECT id,body FROM notification_history WHERE user_id=? AND read_at IS NULL AND created_at>=? AND JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.event"))="screenshot" AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.chat_id")) AS UNSIGNED)=? ORDER BY id LIMIT 20');
        $alerts->execute([$user['id'], $since, $chatId]);
        $screenshotAlerts = $alerts->fetchAll();
    }
    out(['messages' => $messages, 'removed_ids' => $removedIds, 'synced_at' => $syncedAt, 'search_query' => $search, 'screenshot_alerts' => $screenshotAlerts]);
}

if ($method === 'POST') {
    $data = input();
    $chatId = (int)($data['chat_id'] ?? 0);
    $type = (string)($data['type'] ?? 'text');
    $body = trim((string)($data['body'] ?? ''));
    $reply = (int)($data['reply_to_message_id'] ?? 0);
    if (!in_array($type, ['text', 'location'], true)) fail('Unsupported message type');
    if ($body === '' && $type === 'text') fail('Message is empty');

    if ($type === 'location') {
        if (!isset($data['latitude'], $data['longitude']) || !is_numeric($data['latitude']) || !is_numeric($data['longitude'])) fail('A valid location is required');
        $latitude = (float)$data['latitude'];
        $longitude = (float)$data['longitude'];
        if (abs($latitude) > 90 || abs($longitude) > 180) fail('A valid location is required');
        $label = trim((string)($data['label'] ?? 'Shared location'));
        if ($label === '') $label = 'Shared location';
        if (strlen($label) > 120) $label = substr($label, 0, 120);
        $body = json_encode(['latitude' => $latitude, 'longitude' => $longitude, 'label' => $label], JSON_UNESCAPED_SLASHES);
    }

    $membershipQuery = db()->prepare('SELECT c.retention_seconds,COALESCE(cus.cleared_through_message_id,0) AS cleared_through_message_id FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id LEFT JOIN chat_user_states cus ON cus.chat_id=c.id AND cus.user_id=cm.user_id WHERE c.id=? AND cm.user_id=? AND cm.status="active"');
    $membershipQuery->execute([$chatId, $user['id']]);
    $membership = $membershipQuery->fetch();
    if (!$membership) fail('Not a member', 403);
    assert_chat_allows_messages($chatId, (int)$user['id']);
    if ($reply) {
        if ($reply <= (int)$membership['cleared_through_message_id']) fail('Invalid reply target');
        $replyQuery = db()->prepare('SELECT r.id FROM messages r LEFT JOIN message_user_states mus ON mus.message_id=r.id AND mus.user_id=? WHERE r.id=? AND r.chat_id=? AND r.deleted_for_everyone=0 AND COALESCE(mus.hidden,0)=0 AND (r.expires_at IS NULL OR r.expires_at>UTC_TIMESTAMP())');
        $replyQuery->execute([$user['id'], $reply, $chatId]);
        if (!$replyQuery->fetch()) fail('Invalid reply target');
    }
    $expires = $membership['retention_seconds'] ? gmdate('Y-m-d H:i:s', time() + (int)$membership['retention_seconds']) : null;
    $createdAt = gmdate('Y-m-d H:i:s');
    $st = db()->prepare('INSERT INTO messages(chat_id,sender_id,type,body,reply_to_message_id,expires_at,created_at) VALUES(?,?,?,?,?,?,?)');
    $st->execute([$chatId,$user['id'],$type,$body,$reply ?: null,$expires,$createdAt]);
    $messageId = (int)db()->lastInsertId();
    db()->prepare('UPDATE chat_user_states SET hidden=0,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')->execute([$chatId, $user['id']]);
    create_chat_notifications($chatId, (int)$user['id'], (string)$user['name'], $type === 'location' ? 'Shared a location' : $body, $messageId);

    $created = db()->prepare('SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.reply_to_message_id,m.edit_count,m.edited_at,m.created_at,u.name AS sender_name,r.body AS reply_to_text,ru.name AS reply_to_sender_name FROM messages m INNER JOIN users u ON u.id=m.sender_id LEFT JOIN messages r ON r.id=m.reply_to_message_id AND r.deleted_for_everyone=0 LEFT JOIN users ru ON ru.id=r.sender_id WHERE m.id=?');
    $created->execute([$messageId]);
    $message = $created->fetch();
    out(['message' => [
        'id'=>(int)$message['id'],'chat_id'=>(int)$message['chat_id'],'sender_id'=>(int)$message['sender_id'],'sender_name'=>$message['sender_name'],
        'type'=>$message['type'],'body'=>$message['body'],'reply_to_message_id'=>$message['reply_to_message_id'] !== null ? (int)$message['reply_to_message_id'] : null,
        'reply_to_text'=>$message['reply_to_text'],'reply_to_sender_name'=>$message['reply_to_sender_name'],'created_at'=>$message['created_at'],'attachments'=>[],
    ]], 201);
}

if ($method === 'DELETE') {
    $messageId = (int)($_GET['id'] ?? 0);
    $scope = strtolower(trim((string)($_GET['scope'] ?? 'self')));
    if ($messageId <= 0) fail('Message id is required');
    if (!in_array($scope, ['self', 'everyone'], true)) fail('Delete scope must be self or everyone');

    $messageQuery = db()->prepare('SELECT m.id,m.chat_id,m.sender_id,m.type,m.body FROM messages m INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status="active" WHERE m.id=? AND m.deleted_for_everyone=0 LIMIT 1');
    $messageQuery->execute([$user['id'], $messageId]);
    $message = $messageQuery->fetch();
    if (!$message) fail('Message not found', 404);

    if ($scope === 'self') {
        $st = db()->prepare('INSERT INTO message_user_states(message_id,user_id,hidden) VALUES(?,?,1) ON DUPLICATE KEY UPDATE hidden=1');
        $st->execute([$messageId, $user['id']]);
        db()->prepare('DELETE q FROM notification_delivery_queue q INNER JOIN notification_history n ON n.id=q.notification_id WHERE n.user_id=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(n.data_json,"$.message_id")) AS UNSIGNED)=?')->execute([$user['id'],$messageId]);
        db()->prepare('DELETE FROM notification_history WHERE user_id=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.message_id")) AS UNSIGNED)=?')->execute([$user['id'],$messageId]);
        out(['message' => 'Message deleted for you', 'message_id' => $messageId, 'scope' => 'self']);
    }

    if ((int)$message['sender_id'] !== (int)$user['id']) fail('Only the sender can delete this message for everyone', 403);
    $attachmentQuery = db()->prepare('SELECT storage_path FROM message_attachments WHERE message_id=?');
    $attachmentQuery->execute([$messageId]);
    $attachmentPaths = $attachmentQuery->fetchAll(PDO::FETCH_COLUMN);
    $pollId = 0;
    if ($message['type'] === 'poll') {
        $pollBody = json_decode((string)$message['body'], true);
        $pollId = (int)($pollBody['poll_id'] ?? 0);
    }

    $pdo = db();
    try {
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM attachment_download_requests WHERE attachment_id IN (SELECT id FROM message_attachments WHERE message_id=?)')->execute([$messageId]);
        $pdo->prepare('DELETE FROM message_attachments WHERE message_id=?')->execute([$messageId]);
        $pdo->prepare('DELETE FROM message_user_states WHERE message_id=?')->execute([$messageId]);
        if ($pollId > 0) {
            $pdo->prepare('DELETE FROM poll_votes WHERE poll_id=?')->execute([$pollId]);
            $pdo->prepare('DELETE FROM poll_options WHERE poll_id=?')->execute([$pollId]);
            $pdo->prepare('DELETE FROM polls WHERE id=?')->execute([$pollId]);
        }
        $pdo->prepare('UPDATE messages SET body=NULL,deleted_for_everyone=1,edited_at=UTC_TIMESTAMP() WHERE id=?')->execute([$messageId]);
        $pdo->prepare('DELETE q FROM notification_delivery_queue q INNER JOIN notification_history n ON n.id=q.notification_id WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(n.data_json,"$.message_id")) AS UNSIGNED)=?')->execute([$messageId]);
        $pdo->prepare('DELETE FROM notification_history WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.message_id")) AS UNSIGNED)=?')->execute([$messageId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('messages.php DELETE error: ' . $error->getMessage());
        fail('Unable to delete message', 500);
    }

    $storageRoot = dirname(__DIR__);
    foreach ($attachmentPaths as $attachmentPath) {
        $path = $storageRoot . '/' . ltrim((string)$attachmentPath, '/');
        if (is_file($path)) @unlink($path);
    }
    out(['message' => 'Message deleted for everyone', 'message_id' => $messageId, 'scope' => 'everyone']);
}

fail('Method not allowed', 405);
