<?php
declare(strict_types=1);

function notification_preferences(int $userId): array {
    $st = db()->prepare('SELECT enabled,message,`group`,attachment,`system` FROM user_notification_preferences WHERE user_id=?');
    $st->execute([$userId]);
    return array_map('boolval', array_merge(['enabled'=>1,'message'=>1,'group'=>1,'attachment'=>1,'system'=>1], $st->fetch() ?: []));
}

// Use the same visibility rules for the inbox, badge and push delivery.
function notification_visibility_sql(): string {
    return <<<'SQL'
        (
            COALESCE(JSON_EXTRACT(h.data_json,'$.chat_id'),0)=0 OR EXISTS (
                SELECT 1 FROM chat_members ncm WHERE ncm.chat_id=CAST(JSON_UNQUOTE(JSON_EXTRACT(h.data_json,'$.chat_id')) AS UNSIGNED)
                AND ncm.user_id=h.user_id AND ncm.status='active'
            )
        ) AND (
            COALESCE(JSON_EXTRACT(h.data_json,'$.message_id'),0)=0 OR EXISTS (
                SELECT 1 FROM messages nm
                INNER JOIN chat_members nmem ON nmem.chat_id=nm.chat_id AND nmem.user_id=h.user_id AND nmem.status='active'
                LEFT JOIN chat_user_states ncs ON ncs.chat_id=nm.chat_id AND ncs.user_id=h.user_id
                LEFT JOIN message_user_states nms ON nms.message_id=nm.id AND nms.user_id=h.user_id
                WHERE nm.id=CAST(JSON_UNQUOTE(JSON_EXTRACT(h.data_json,'$.message_id')) AS UNSIGNED)
                AND nm.deleted_for_everyone=0 AND (nm.expires_at IS NULL OR nm.expires_at>UTC_TIMESTAMP())
                AND nm.id>COALESCE(ncs.cleared_through_message_id,0) AND COALESCE(nms.hidden,0)=0
            )
        )
    SQL;
}

function notification_unread_count(int $userId): int {
    $st = db()->prepare('SELECT COUNT(*) FROM notification_history h WHERE h.user_id=? AND h.read_at IS NULL AND ' . notification_visibility_sql());
    $st->execute([$userId]);
    return (int)$st->fetchColumn();
}

function cancel_read_notification_deliveries(int $userId): void {
    db()->prepare("UPDATE notification_delivery_queue q INNER JOIN notification_history h ON h.id=q.notification_id SET q.status='FAILED',q.last_error='Already read' WHERE h.user_id=? AND h.read_at IS NOT NULL AND q.status='PENDING'")->execute([$userId]);
}

function pending_notification_deliveries(int $limit = 100): array {
    $limit = max(1,min(100,$limit));
    $joins = <<<'SQL'
        INNER JOIN notification_devices d ON d.id=q.device_id
        INNER JOIN notification_history h ON h.id=q.notification_id
        LEFT JOIN user_notification_preferences np ON np.user_id=h.user_id
    SQL;
    $eligible = "d.revoked_at IS NULL AND d.user_id=h.user_id AND h.read_at IS NULL AND COALESCE(np.enabled,1)=1
        AND CASE h.category WHEN 'message' THEN COALESCE(np.message,1) WHEN 'group' THEN COALESCE(np.`group`,1) WHEN 'attachment' THEN COALESCE(np.attachment,1) ELSE COALESCE(np.`system`,1) END=1
        AND (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(h.data_json,'$.chat_type')),'')<>'group' OR COALESCE(np.`group`,1)=1)
        AND NOT EXISTS (SELECT 1 FROM chat_user_states muted WHERE muted.user_id=h.user_id AND muted.chat_id=CAST(JSON_UNQUOTE(JSON_EXTRACT(h.data_json,'$.chat_id')) AS UNSIGNED) AND muted.notifications_muted=1)
        AND " . notification_visibility_sql();
    db()->exec("UPDATE notification_delivery_queue q $joins SET q.status='FAILED',q.last_error='No longer eligible for delivery' WHERE q.status='PENDING' AND NOT ($eligible)");
    $rows = db()->query("SELECT q.id,q.device_id,d.token,h.user_id,h.title,h.body,h.data_json FROM notification_delivery_queue q $joins WHERE q.status='PENDING' AND q.available_at<=UTC_TIMESTAMP() AND ($eligible) ORDER BY q.id LIMIT $limit")->fetchAll();
    $counts = [];
    foreach ($rows as &$row) {
        $uid = (int)$row['user_id'];
        if (!isset($counts[$uid])) $counts[$uid] = notification_unread_count($uid);
        $row['unread_count'] = $counts[$uid];
    }
    unset($row);
    return $rows;
}
