<?php
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/mentions.php';

$user = auth_user();
$userId = (int)$user['id'];
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$pdo = db();

function assert_mention_chat_access(PDO $pdo, int $chatId, int $userId): string {
    if ($chatId <= 0) fail('Chat id is required', 422);
    $st = $pdo->prepare('SELECT c.type FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? AND cm.status="active" WHERE c.id=? LIMIT 1');
    $st->execute([$userId, $chatId]);
    $type = $st->fetchColumn();
    if (!in_array($type, ['group', 'public'], true)) fail('Mentions are available only in group chats and public rooms', 403);
    return (string)$type;
}

if ($method === 'GET') {
    $action = (string)($_GET['action'] ?? 'list');
    if ($action === 'message') {
        $messageId = (int)($_GET['message_id'] ?? 0);
        if ($messageId <= 0) fail('Message id is required', 422);
        $owned = $pdo->prepare('SELECT m.chat_id,c.type FROM messages m INNER JOIN chats c ON c.id=m.chat_id WHERE m.id=? AND m.sender_id=? AND m.deleted_for_everyone=0 LIMIT 1');
        $owned->execute([$messageId, $userId]);
        $message = $owned->fetch();
        if (!$message || !in_array((string)$message['type'], ['group','public'], true)) fail('Message is unavailable for mention editing', 404);
        assert_mention_chat_access($pdo, (int)$message['chat_id'], $userId);
        $st = $pdo->prepare('SELECT mm.recipient_id AS id,u.user_id AS username,u.name FROM message_mentions mm INNER JOIN users u ON u.id=mm.recipient_id INNER JOIN chat_members cm ON cm.chat_id=mm.chat_id AND cm.user_id=mm.recipient_id AND cm.status="active" WHERE mm.message_id=? AND mm.removed_at IS NULL AND u.account_status="active" ORDER BY mm.id');
        $st->execute([$messageId]);
        out(['message_id'=>$messageId,'mention_recipients'=>$st->fetchAll()]);
    }
    if ($action === 'candidates') {
        $chatId = (int)($_GET['chat_id'] ?? 0);
        assert_mention_chat_access($pdo, $chatId, $userId);
        $query = trim((string)($_GET['q'] ?? ''));
        if (strlen($query) > 120) $query = substr($query, 0, 120);
        $like = '%' . $query . '%';
        $st = $pdo->prepare('SELECT u.id,u.user_id AS username,u.name FROM chat_members cm INNER JOIN users u ON u.id=cm.user_id WHERE cm.chat_id=? AND cm.status="active" AND u.account_status="active" AND cm.user_id<>? AND (?="" OR u.name LIKE ? OR u.user_id LIKE ?) ORDER BY u.name,u.id LIMIT 30');
        $st->execute([$chatId, $userId, $query, $like, $like]);
        out(['chat_id'=>$chatId,'candidates'=>$st->fetchAll()]);
    }
    if ($action !== 'list') fail('Unsupported mentions action', 422);
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $beforeId = max(0, (int)($_GET['before_id'] ?? 0));
    $visibility = 'mm.recipient_id=? AND mm.removed_at IS NULL AND c.type IN ("group","public") AND cm.status="active" AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0';
    $params = [$userId];
    $sql = 'SELECT mm.id AS mention_id,mm.message_id,mm.chat_id,mm.sender_id,mm.recipient_id,mm.chat_type,mm.read_at,mm.created_at,m.body AS message_body,m.created_at AS message_created_at,u.name AS sender_name,c.name AS chat_name,mm.notification_id FROM message_mentions mm INNER JOIN messages m ON m.id=mm.message_id INNER JOIN chats c ON c.id=mm.chat_id INNER JOIN chat_members cm ON cm.chat_id=mm.chat_id AND cm.user_id=mm.recipient_id LEFT JOIN chat_user_states cus ON cus.chat_id=mm.chat_id AND cus.user_id=mm.recipient_id LEFT JOIN message_user_states mus ON mus.message_id=mm.message_id AND mus.user_id=mm.recipient_id INNER JOIN users u ON u.id=mm.sender_id WHERE ' . $visibility;
    if ($beforeId > 0) { $sql .= ' AND mm.id<?'; $params[] = $beforeId; }
    $sql .= ' ORDER BY mm.id DESC LIMIT ' . ($limit + 1);
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $items = $st->fetchAll();
    $hasMore = count($items) > $limit;
    if ($hasMore) array_pop($items);
    foreach ($items as &$item) {
        $item['mention_id'] = (int)$item['mention_id'];
        $item['message_id'] = (int)$item['message_id'];
        $item['chat_id'] = (int)$item['chat_id'];
        $item['sender_id'] = (int)$item['sender_id'];
        $item['notification_id'] = $item['notification_id'] === null ? null : (int)$item['notification_id'];
        unset($item['recipient_id']);
    }
    unset($item);
    $countSql = 'SELECT COUNT(*) FROM message_mentions mm INNER JOIN messages m ON m.id=mm.message_id INNER JOIN chats c ON c.id=mm.chat_id INNER JOIN chat_members cm ON cm.chat_id=mm.chat_id AND cm.user_id=mm.recipient_id LEFT JOIN chat_user_states cus ON cus.chat_id=mm.chat_id AND cus.user_id=mm.recipient_id LEFT JOIN message_user_states mus ON mus.message_id=mm.message_id AND mus.user_id=mm.recipient_id WHERE ' . $visibility . ' AND mm.read_at IS NULL';
    $count = $pdo->prepare($countSql);
    $count->execute([$userId]);
    out(['mentions'=>$items,'unread_count'=>(int)$count->fetchColumn(),'has_more'=>$hasMore]);
}

if ($method === 'POST') {
    $data = input();
    if (($data['action'] ?? '') !== 'open') fail('Unsupported mentions action', 422);
    $mentionId = (int)($data['mention_id'] ?? 0);
    if ($mentionId <= 0) fail('Mention id is required', 422);
    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare('SELECT mm.id AS mention_id,mm.message_id,mm.chat_id,mm.sender_id,mm.chat_type,mm.notification_id,m.body,m.created_at,c.name AS chat_name,u.name AS sender_name FROM message_mentions mm INNER JOIN messages m ON m.id=mm.message_id INNER JOIN chats c ON c.id=mm.chat_id INNER JOIN chat_members cm ON cm.chat_id=mm.chat_id AND cm.user_id=mm.recipient_id AND cm.status="active" LEFT JOIN chat_user_states cus ON cus.chat_id=mm.chat_id AND cus.user_id=mm.recipient_id LEFT JOIN message_user_states mus ON mus.message_id=mm.message_id AND mus.user_id=mm.recipient_id INNER JOIN users u ON u.id=mm.sender_id WHERE mm.id=? AND mm.recipient_id=? AND mm.removed_at IS NULL AND c.type IN ("group","public") AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0 FOR UPDATE');
        $st->execute([$mentionId, $userId]);
        $mention = $st->fetch();
        if (!$mention) { $pdo->rollBack(); fail('Mention is no longer available or access has been revoked', 404); }
        $pdo->prepare('UPDATE message_mentions SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE id=?')->execute([$mentionId]);
        if ($mention['notification_id'] !== null) {
            $pdo->prepare('UPDATE notification_history SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE id=? AND user_id=?')->execute([(int)$mention['notification_id'], $userId]);
        }
        cancel_read_notification_deliveries($userId);
        $pdo->commit();
        $unread = $pdo->prepare('SELECT COUNT(*) FROM message_mentions mm INNER JOIN messages m ON m.id=mm.message_id INNER JOIN chats c ON c.id=mm.chat_id INNER JOIN chat_members cm ON cm.chat_id=mm.chat_id AND cm.user_id=mm.recipient_id AND cm.status="active" LEFT JOIN chat_user_states cus ON cus.chat_id=mm.chat_id AND cus.user_id=mm.recipient_id LEFT JOIN message_user_states mus ON mus.message_id=mm.message_id AND mus.user_id=mm.recipient_id WHERE mm.recipient_id=? AND mm.removed_at IS NULL AND mm.read_at IS NULL AND c.type IN ("group","public") AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0');
        $unread->execute([$userId]);
        out(['mention'=>[
            'mention_id'=>(int)$mention['mention_id'],'message_id'=>(int)$mention['message_id'],'chat_id'=>(int)$mention['chat_id'],
            'sender_id'=>(int)$mention['sender_id'],'chat_type'=>$mention['chat_type'],'message_body'=>$mention['body'],
            'message_created_at'=>$mention['created_at'],'chat_name'=>$mention['chat_name'],'sender_name'=>$mention['sender_name']
        ],'unread_count'=>(int)$unread->fetchColumn()]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Mention open failed: ' . $error->getMessage());
        fail('Unable to open mention', 500);
    }
}
fail('Method not allowed', 405);
