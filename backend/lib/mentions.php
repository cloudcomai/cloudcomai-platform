<?php
declare(strict_types=1);

/** Normalize stable internal user IDs supplied by the @Mention picker. */
function normalize_mention_user_ids(mixed $raw): array {
    if (!is_array($raw) || count($raw) > 100) fail('mention_user_ids must be an array of up to 100 users', 422);
    $ids = [];
    foreach ($raw as $value) {
        if (filter_var($value, FILTER_VALIDATE_INT) === false || (int)$value < 1) fail('Invalid mentioned user', 422);
        $id = (int)$value;
        if (!in_array($id, $ids, true)) $ids[] = $id;
    }
    sort($ids, SORT_NUMERIC); // Canonical order keeps idempotency fingerprints stable.
    return $ids;
}

/**
 * Reconcile the active recipients for a message. Call inside the surrounding
 * message transaction so mention rows and notification history commit together.
 * Removed rows are retained for history; only active rows appear in the inbox.
 */
function reconcile_message_mentions(int $messageId, int $chatId, int $senderId, array $recipientIds): void {
    $pdo = db();
    $chatQuery = $pdo->prepare('SELECT c.type,m.body,u.name AS sender_name FROM chats c INNER JOIN messages m ON m.chat_id=c.id INNER JOIN users u ON u.id=m.sender_id WHERE c.id=? AND m.id=? AND m.sender_id=? AND m.deleted_for_everyone=0');
    $chatQuery->execute([$chatId, $messageId, $senderId]);
    $message = $chatQuery->fetch();
    if (!$message) fail('Message is unavailable for mentions', 409);
    $chatType = (string)$message['type'];
    if (!in_array($chatType, ['group', 'public'], true)) {
        if ($recipientIds) fail('@Mentions are available only in group chats and public rooms', 422);
        return;
    }
    if (count($recipientIds) > 100) fail('A message can mention at most 100 users', 422);
    $recipientIds = array_values(array_unique(array_map('intval', $recipientIds)));
    foreach ($recipientIds as $recipientId) {
        if ($recipientId <= 0 || $recipientId === $senderId) fail('Choose another eligible member to mention', 422);
        $eligible = $pdo->prepare('SELECT 1 FROM chat_members cm INNER JOIN users u ON u.id=cm.user_id WHERE cm.chat_id=? AND cm.user_id=? AND cm.status="active" AND u.account_status="active" LIMIT 1');
        $eligible->execute([$chatId, $recipientId]);
        if (!$eligible->fetchColumn()) fail('A mentioned user is not an eligible active member of this chat', 422);
    }

    $activeQuery = $pdo->prepare('SELECT id,recipient_id,notification_id,read_at FROM message_mentions WHERE message_id=? AND removed_at IS NULL FOR UPDATE');
    $activeQuery->execute([$messageId]);
    $activeRows = $activeQuery->fetchAll();
    $activeByRecipient = [];
    foreach ($activeRows as $row) $activeByRecipient[(int)$row['recipient_id']] = $row;

    foreach ($activeRows as $row) {
        $recipientId = (int)$row['recipient_id'];
        if (in_array($recipientId, $recipientIds, true)) continue;
        $pdo->prepare('UPDATE message_mentions SET removed_at=UTC_TIMESTAMP() WHERE id=? AND removed_at IS NULL')->execute([(int)$row['id']]);
        // Remove an unread notification from active surfaces. Read notification
        // history remains available while the mention itself is no longer active.
        if ($row['read_at'] === null && $row['notification_id'] !== null) {
            $notificationId = (int)$row['notification_id'];
            $pdo->prepare('DELETE FROM notification_delivery_queue WHERE notification_id=?')->execute([$notificationId]);
            $pdo->prepare('DELETE FROM notification_history WHERE id=? AND user_id=? AND read_at IS NULL')->execute([$notificationId, $recipientId]);
        }
    }

    $category = $chatType === 'group' ? 'group' : 'message';
    $preview = trim((string)($message['body'] ?? ''));
    if ($preview === '') $preview = 'Mentioned you in a message';
    $preview = function_exists('mb_substr') ? mb_substr($preview, 0, 420) : substr($preview, 0, 420);
    foreach ($recipientIds as $recipientId) {
        if (isset($activeByRecipient[$recipientId])) continue; // retained mention: do not re-notify
        $insert = $pdo->prepare('INSERT INTO message_mentions(message_id,chat_id,sender_id,recipient_id,chat_type,created_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP())');
        $insert->execute([$messageId, $chatId, $senderId, $recipientId, $chatType]);
        $mentionId = (int)$pdo->lastInsertId();
        $mute = $pdo->prepare('SELECT notifications_muted FROM chat_user_states WHERE chat_id=? AND user_id=? LIMIT 1');
        $mute->execute([$chatId, $recipientId]);
        $deliverPush = !(bool)$mute->fetchColumn();
        $notificationId = queue_user_notification(
            $recipientId,
            $category,
            (string)$message['sender_name'] . ' mentioned you',
            $preview,
            ['event'=>'mention','mention_id'=>$mentionId,'chat_id'=>$chatId,'chat_type'=>$chatType,'message_id'=>$messageId],
            $deliverPush
        );
        $pdo->prepare('UPDATE message_mentions SET notification_id=? WHERE id=?')->execute([$notificationId, $mentionId]);
    }
}

/** Deactivate mention inbox entries when a message becomes invisible to a user. */
function deactivate_message_mentions(int $messageId, ?int $recipientId = null): void {
    $pdo = db();
    $sql = 'SELECT id,recipient_id,notification_id,read_at FROM message_mentions WHERE message_id=? AND removed_at IS NULL';
    $params = [$messageId];
    if ($recipientId !== null) { $sql .= ' AND recipient_id=?'; $params[] = $recipientId; }
    $sql .= ' FOR UPDATE';
    $st = $pdo->prepare($sql);
    $st->execute($params);
    foreach ($st->fetchAll() as $row) {
        $pdo->prepare('UPDATE message_mentions SET removed_at=UTC_TIMESTAMP() WHERE id=? AND removed_at IS NULL')->execute([(int)$row['id']]);
        if ($row['read_at'] === null && $row['notification_id'] !== null) {
            $notificationId = (int)$row['notification_id'];
            $pdo->prepare('DELETE FROM notification_delivery_queue WHERE notification_id=?')->execute([$notificationId]);
            $pdo->prepare('DELETE FROM notification_history WHERE id=? AND user_id=? AND read_at IS NULL')->execute([$notificationId, (int)$row['recipient_id']]);
        }
    }
}
