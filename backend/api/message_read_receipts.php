<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = input();
    $messageIds = $data['message_ids'] ?? ($data['message_id'] ?? []);
    if (!is_array($messageIds)) $messageIds = [$messageIds];
    $messageIds = array_values(array_unique(array_filter(array_map('intval', $messageIds), static fn(int $id): bool => $id > 0)));
    if (!$messageIds || count($messageIds) > 100) fail('Provide between 1 and 100 message ids');

    $placeholders = implode(',', array_fill(0, count($messageIds), '?'));
    $query = db()->prepare("SELECT m.id,m.chat_id,m.sender_id,c.type FROM messages m INNER JOIN chats c ON c.id=m.chat_id INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status='active' WHERE m.id IN ($placeholders) AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())");
    $query->execute(array_merge([(int)$user['id']], $messageIds));
    $allowed = $query->fetchAll();

    $marked = [];
    foreach ($allowed as $message) {
        if (!in_array($message['type'], ['private', 'group'], true)) continue;
        if ((int)$message['sender_id'] === (int)$user['id']) continue;
        $insert = db()->prepare('INSERT INTO message_read_receipts(message_id,user_id,read_at) VALUES(?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE read_at=read_at');
        $insert->execute([(int)$message['id'], (int)$user['id']]);
        $marked[] = (int)$message['id'];
    }
    out(['message_ids' => $marked]);
}

if ($method === 'GET') {
    $messageId = (int)($_GET['message_id'] ?? 0);
    if ($messageId <= 0) fail('Message id is required');
    $messageQuery = db()->prepare('SELECT m.id,m.chat_id,m.sender_id,c.type FROM messages m INNER JOIN chats c ON c.id=m.chat_id INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status="active" WHERE m.id=? LIMIT 1');
    $messageQuery->execute([(int)$user['id'], $messageId]);
    $message = $messageQuery->fetch();
    if (!$message) fail('Message not found', 404);
    if (!in_array($message['type'], ['private', 'group'], true)) out(['eligible' => false, 'is_sender' => (int)$message['sender_id'] === (int)$user['id'], 'read' => false, 'read_by' => []]);

    $receipts = db()->prepare('SELECT r.user_id,u.name,r.read_at FROM message_read_receipts r INNER JOIN users u ON u.id=r.user_id WHERE r.message_id=? AND r.user_id<>? ORDER BY r.read_at ASC,r.user_id ASC');
    $receipts->execute([$messageId, (int)$message['sender_id']]);
    $rows = $receipts->fetchAll();
    $readBy = array_map(static fn(array $row): array => ['user_id'=>(int)$row['user_id'],'name'=>$row['name'],'read_at'=>$row['read_at']], $rows);
    out(['eligible' => true, 'is_sender' => (int)$message['sender_id'] === (int)$user['id'], 'read' => !empty($readBy), 'read_by' => $readBy]);
}

fail('Method not allowed', 405);
