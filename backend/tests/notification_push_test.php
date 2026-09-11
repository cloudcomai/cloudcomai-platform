<?php
declare(strict_types=1);
require __DIR__ . '/../lib/notification_push.php';

$row = [
    'token' => 'ExponentPushToken[test]',
    'title' => 'Alex',
    'body' => 'Hello 😀',
    'unread_count' => 7,
    'data_json' => json_encode(['chat_id' => 42, 'message_id' => 99], JSON_UNESCAPED_SLASHES),
];

$payload = build_expo_push_payload($row);
assert($payload['to'] === 'ExponentPushToken[test]');
assert($payload['badge'] === 7);
assert($payload['channelId'] === 'messages');
assert($payload['priority'] === 'high');
assert($payload['ttl'] === 86400);
assert($payload['data']['chat_id'] === 42);
assert($payload['data']['message_id'] === 99);

$invalid = build_expo_push_payload([...$row, 'data_json' => '{invalid']);
assert($invalid['data'] === []);

$migration = file_get_contents(__DIR__ . '/../database/migrations/015_notification_delivery_queue.sql');
assert(is_string($migration));
assert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS notification_delivery_queue'));
assert(str_contains($migration, 'UNIQUE KEY uq_notification_delivery (notification_id, device_id)'));
assert(str_contains($migration, 'INDEX idx_notification_delivery_pending (status, available_at, id)'));

echo "notification_push_test.php passed\n";
