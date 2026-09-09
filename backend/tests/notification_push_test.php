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
assert($payload['to'] === 'ExponentPushToken[test']);
assert($payload['title'] === 'Alex');
assert($payload['body'] === 'Hello 😀');
assert($payload['badge'] === 7);
assert($payload['channelId'] === 'messages');
assert($payload['priority'] === 'high');
assert($payload['ttl'] === 86400);
assert($payload['data']['chat_id'] === 42);
assert($payload['data']['message_id'] === 99);

$invalidData = build_expo_push_payload([...$row, 'data_json' => '{invalid']);
assert($invalidData['data'] === []);

echo "notification_push_test.php passed\n";
