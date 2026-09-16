<?php
declare(strict_types=1);

function build_expo_push_payload(array $row): array {
    $data = [];
    if (!empty($row['data_json'])) {
        $decoded = json_decode((string)$row['data_json'], true);
        if (is_array($decoded)) $data = $decoded;
    }

    $preview = (bool)($row['preview'] ?? true);
    $sound = (bool)($row['sound'] ?? true);
    $vibration = (bool)($row['vibration'] ?? true);
    $channel = (!$sound && !$vibration)
        ? 'messages_silent_v2'
        : ($sound && $vibration ? 'messages_alerts_v2' : ($sound ? 'messages_sound_v2' : 'messages_vibration_v2'));

    $body = $preview ? (string)$row['body'] : 'New message';
    if (!$preview) {
        $data['preview_hidden'] = true;
    }

    return [
        'to' => (string)$row['token'],
        'title' => (string)$row['title'],
        'body' => $body,
        'sound' => $sound ? 'default' : null,
        'badge' => (int)($row['unread_count'] ?? 0),
        'channelId' => $channel,
        'priority' => 'high',
        'ttl' => 86400,
        'data' => $data,
    ];
}
