<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
$data = $method === 'POST' ? input() : [];
$chatId = (int)($_GET['chat_id'] ?? $data['chat_id'] ?? 0);
if ($chatId <= 0) fail('chat_id is required', 422);
$member = $pdo->prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status="active"');
$member->execute([$chatId, $user['id']]);
if (!$member->fetchColumn()) fail('Chat not found',404);
if ($method === 'POST') {
    if (array_key_exists('mute_for', $data)) {
        $choice = (string)$data['mute_for'];
        $durations = ['10_hours' => 10 * 3600, '1_week' => 7 * 86400, '2_weeks' => 14 * 86400, 'always' => null, 'off' => 0];
        if (!array_key_exists($choice, $durations)) fail('Choose 10 hours, 1 week, 2 weeks, Always, or Unmute',422);
        $muted = $choice === 'off' ? 0 : 1;
        $until = $choice === 'always' ? null : ($choice === 'off' ? null : gmdate('Y-m-d H:i:s', time() + $durations[$choice]));
        $pdo->prepare('INSERT INTO chat_user_states(chat_id,user_id,notifications_muted,notifications_muted_until,updated_at) VALUES(?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE notifications_muted=VALUES(notifications_muted),notifications_muted_until=VALUES(notifications_muted_until),updated_at=UTC_TIMESTAMP()')->execute([$chatId,$user['id'],$muted,$until]);
    } elseif (array_key_exists('muted',$data)) {
        if (!is_bool($data['muted'])) fail('muted must be true or false',422);
        $pdo->prepare('INSERT INTO chat_user_states(chat_id,user_id,notifications_muted,notifications_muted_until,updated_at) VALUES(?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE notifications_muted=VALUES(notifications_muted),notifications_muted_until=VALUES(notifications_muted_until),updated_at=UTC_TIMESTAMP()')->execute([$chatId,$user['id'],(int)$data['muted'],$data['muted'] ? null : null]);
    } elseif (($data['mark_read'] ?? false) === true) {
        $through = $data['last_read_message_id'] ?? PHP_INT_MAX;
        if (filter_var($through,FILTER_VALIDATE_INT) === false || $through<0) fail('Invalid read watermark',422);
        $pdo->beginTransaction();
        try {
            $latest = $pdo->prepare('SELECT COALESCE(MAX(m.id),0) FROM messages m LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=? LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=? WHERE m.chat_id=? AND m.id<=? AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0 AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())');
            $latest->execute([$user['id'],$user['id'],$chatId,$through]);
            $messageId=(int)$latest->fetchColumn();
            $pdo->prepare('INSERT INTO chat_user_states(chat_id,user_id,last_read_message_id,updated_at) VALUES(?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE last_read_message_id=GREATEST(last_read_message_id,VALUES(last_read_message_id)),updated_at=UTC_TIMESTAMP()')->execute([$chatId,$user['id'],$messageId]);
            $pdo->prepare('UPDATE notification_history SET read_at=UTC_TIMESTAMP() WHERE user_id=? AND read_at IS NULL AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.chat_id")) AS UNSIGNED)=? AND CAST(JSON_UNQUOTE(JSON_EXTRACT(data_json,"$.message_id")) AS UNSIGNED)<=?')->execute([$user['id'],$chatId,$messageId]);
            cancel_read_notification_deliveries((int)$user['id']);
            $pdo->commit();
        } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
    } else fail('mute_for, muted or mark_read is required',422);
} elseif ($method !== 'GET') fail('Method not allowed',405);
$st=$pdo->prepare('SELECT notifications_muted,notifications_muted_until,last_read_message_id FROM chat_user_states WHERE chat_id=? AND user_id=?');
$st->execute([$chatId,$user['id']]);
$row=$st->fetch() ?: [];
$muted=(bool)($row['notifications_muted'] ?? false);
$until=$row['notifications_muted_until'] ?? null;
if ($muted && $until !== null && $until <= gmdate('Y-m-d H:i:s')) {
    $pdo->prepare('UPDATE chat_user_states SET notifications_muted=0,notifications_muted_until=NULL,updated_at=UTC_TIMESTAMP() WHERE chat_id=? AND user_id=?')->execute([$chatId,$user['id']]);
    $muted=false; $until=null;
}
$unread=$pdo->prepare('SELECT COUNT(*) FROM messages m LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=? LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=? WHERE m.chat_id=? AND m.sender_id<>? AND m.id>GREATEST(COALESCE(cus.last_read_message_id,0),COALESCE(cus.cleared_through_message_id,0)) AND m.deleted_for_everyone=0 AND COALESCE(mus.hidden,0)=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())');
$unread->execute([$user['id'],$user['id'],$chatId,$user['id']]);
out(['unread_messages_count'=>(int)$unread->fetchColumn(),'chat_id'=>$chatId,'muted'=>$muted,'muted_until'=>$until,'last_read_message_id'=>(int)($row['last_read_message_id'] ?? 0),'unread_count'=>notification_unread_count((int)$user['id'])]);
