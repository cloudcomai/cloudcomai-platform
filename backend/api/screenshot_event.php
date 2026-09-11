<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);

$data = input();
$chatId = (int)($data['chat_id'] ?? 0);
if ($chatId <= 0) fail('Chat id is required');

$member = db()->prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status="active" LIMIT 1');
$member->execute([$chatId, $user['id']]);
if (!$member->fetch()) fail('Not a member', 403);
assert_chat_allows_messages($chatId, (int)$user['id']);

$conversation = db()->prepare(<<<'SQL'
    SELECT c.name, c.type,
           (
               SELECT u.name
               FROM chat_members cm2
               INNER JOIN users u ON u.id=cm2.user_id
               WHERE cm2.chat_id=c.id AND cm2.user_id<>? AND cm2.status='active'
               ORDER BY cm2.user_id
               LIMIT 1
           ) AS peer_name
    FROM chats c
    WHERE c.id=?
    LIMIT 1
SQL);
$conversation->execute([$user['id'], $chatId]);
$conversationRow = $conversation->fetch();
if (!$conversationRow) fail('Conversation not found', 404);
$conversationName = trim((string)($conversationRow['name'] ?: $conversationRow['peer_name'] ?: 'CloudComAI conversation'));

// Native listeners can fire more than once for the same capture.
$recent = db()->prepare('SELECT id FROM notification_history WHERE created_at>UTC_TIMESTAMP()-INTERVAL 10 SECOND AND JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.event"))="screenshot" AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.actor_id")) AS UNSIGNED)=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.chat_id")) AS UNSIGNED)=? LIMIT 1');
$recent->execute([$user['id'], $chatId]);
if ($recent->fetch()) out(['message' => 'Screenshot event already recorded', 'notified_users' => 0]);

$recipients = db()->prepare(<<<'SQL'
    SELECT cm.user_id
    FROM chat_members cm
    LEFT JOIN user_privacy_settings ups ON ups.user_id=cm.user_id
    WHERE cm.chat_id=? AND cm.user_id<>? AND cm.status='active'
      AND COALESCE(ups.screenshot_alerts,1)=1
SQL);
$recipients->execute([$chatId, $user['id']]);
$recipientIds = array_map('intval', $recipients->fetchAll(PDO::FETCH_COLUMN));

$notified = 0;
foreach ($recipientIds as $recipientId) {
    if (users_block_state((int)$user['id'], $recipientId)['blocked']) continue;
    queue_user_notification(
        $recipientId,
        'system',
        'Screenshot alert',
        (string)$user['name'] . ' took a screenshot of ' . $conversationName . '.',
        [
            'category' => 'system',
            'event' => 'screenshot',
            'chat_id' => $chatId,
            'chat_name' => $conversationName,
            'actor_id' => (int)$user['id'],
            'actor_name' => (string)$user['name'],
        ]
    );
    $notified++;
}

out(['message' => 'Screenshot event recorded', 'notified_users' => $notified], 201);
