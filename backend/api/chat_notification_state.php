<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$chatId = (int)($_GET['chat_id'] ?? (input()['chat_id'] ?? 0));
if ($chatId <= 0) fail('chat_id is required', 422);

$member = $pdo->prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status="active" LIMIT 1');
$member->execute([$chatId, $user['id']]);
if (!$member->fetchColumn()) fail('Chat not found', 404);

if ($method === 'GET') {
    $st = $pdo->prepare('SELECT notifications_muted,last_read_message_id FROM chat_user_states WHERE chat_id=? AND user_id=? LIMIT 1');
    $st->execute([$chatId, $user['id']]);
    $row = $st->fetch() ?: [];
    out([
        'chat_id' => $chatId,
        'muted' => (bool)($row['notifications_muted'] ?? false),
        'last_read_message_id' => (int)($row['last_read_message_id'] ?? 0),
    ]);
}

if ($method === 'POST') {
    $data = input();
    if (array_key_exists('muted', $data)) {
        $muted = !empty($data['muted']) ? 1 : 0;
        $st = $pdo->prepare('
            INSERT INTO chat_user_states(chat_id,user_id,notifications_muted,updated_at)
            VALUES(?,?,?,UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE notifications_muted=VALUES(notifications_muted),updated_at=UTC_TIMESTAMP()
        ');
        $st->execute([$chatId, $user['id'], $muted]);
        out(['chat_id' => $chatId, 'muted' => (bool)$muted]);
    }
    if (!empty($data['mark_read'])) {
        $latest = $pdo->prepare('SELECT COALESCE(MAX(id),0) FROM messages WHERE chat_id=? AND deleted_for_everyone=0');
        $latest->execute([$chatId]);
        $messageId = (int)$latest->fetchColumn();
        $st = $pdo->prepare('
            INSERT INTO chat_user_states(chat_id,user_id,last_read_message_id,updated_at)
            VALUES(?,?,?,UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE last_read_message_id=GREATEST(last_read_message_id,VALUES(last_read_message_id)),updated_at=UTC_TIMESTAMP()
        ');
        $st->execute([$chatId, $user['id'], $messageId]);
        $read = $pdo->prepare('UPDATE notification_history SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE user_id=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.chat_id")) AS UNSIGNED)=? AND read_at IS NULL');
        $read->execute([$user['id'], $chatId]);
        out(['chat_id' => $chatId, 'last_read_message_id' => $messageId, 'notifications_read' => $read->rowCount()]);
    }
    fail('muted or mark_read is required', 422);
}

fail('Method not allowed', 405);
