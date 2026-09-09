<?php
declare(strict_types=1);

/**
 * Build an Expo Push Service payload for one queued notification.
 * Android uses high priority so messages are delivered promptly while the
 * device is locked/dozing. A 24-hour TTL lets FCM deliver after a short
 * offline period instead of silently expiring the notification immediately.
 */
function build_expo_push_payload(array $row): array {
    $data = [];
    if (!empty($row['data_json'])) {
        $decoded = json_decode((string)$row['data_json'], true);
        if (is_array($decoded)) $data = $decoded;
    }

    return [
        'to' => (string)$row['token'],
        'title' => (string)$row['title'],
        'body' => (string)$row['body'],
        'sound' => 'default',
        'badge' => (int)($row['unread_count'] ?? 0),
        'channelId' => 'messages',
        'priority' => 'high',
        'ttl' => 86400,
        'data' => $data,
    ];
}
