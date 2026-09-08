<?php
declare(strict_types=1);

function hydrate_message_attachments(array &$messages): void {
    if (!$messages) return;
    $ids = array_values(array_filter(array_map(fn($message) => (int)($message['id'] ?? 0), $messages)));
    if (!$ids) return;
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $st = db()->prepare("SELECT id,message_id,original_filename,mime_type,file_size,download_policy FROM message_attachments WHERE message_id IN ($placeholders) ORDER BY id ASC");
    $st->execute($ids);
    $attachments = [];
    foreach ($st->fetchAll() as $attachment) {
        $attachments[(int)$attachment['message_id']][] = [
            'id' => (int)$attachment['id'],
            'name' => $attachment['original_filename'],
            'mime_type' => $attachment['mime_type'],
            'file_size' => (int)$attachment['file_size'],
            'download_policy' => $attachment['download_policy'],
        ];
    }
    foreach ($messages as &$message) {
        $messageAttachments = $attachments[(int)$message['id']] ?? [];
        $message['attachments'] = $messageAttachments;
        $message['attachment'] = $messageAttachments[0] ?? null;
    }
    unset($message);
}

function hydrate_message_polls(array &$messages, int $userId): void {
    $pollQuery = db()->prepare('SELECT p.id,p.question,p.closes_at,po.id AS option_id,po.option_text,po.display_order,COUNT(pv.user_id) AS votes,MAX(CASE WHEN pv.user_id=? THEN 1 ELSE 0 END) AS selected FROM polls p INNER JOIN poll_options po ON po.poll_id=p.id LEFT JOIN poll_votes pv ON pv.option_id=po.id AND pv.poll_id=p.id WHERE p.id=? GROUP BY p.id,p.question,p.closes_at,po.id,po.option_text,po.display_order ORDER BY po.display_order ASC,po.id ASC');
    foreach ($messages as &$message) {
        if ($message['type'] !== 'poll') continue;
        $meta = json_decode((string)$message['body'], true);
        $pollId = (int)($meta['poll_id'] ?? 0);
        if ($pollId <= 0) continue;
        $pollQuery->execute([$userId, $pollId]);
        $rows = $pollQuery->fetchAll();
        if (!$rows) continue;
        $options = [];
        foreach ($rows as $row) $options[] = ['id'=>(int)$row['option_id'],'text'=>$row['option_text'],'votes'=>(int)$row['votes'],'selected'=>(bool)$row['selected']];
        $message['poll_id'] = $pollId;
        $message['poll'] = ['id'=>$pollId,'question'=>$rows[0]['question'],'options'=>$options,'expires_at'=>$rows[0]['closes_at']];
    }
    unset($message);
}


function hydrate_message_state(array &$messages, int $userId): void {
    if (!$messages) return;
    $ids=array_map(static fn($m)=>(int)$m['id'],$messages);
    $marks=implode(',',array_fill(0,count($ids),'?'));
    $keys=db()->prepare("SELECT message_id,client_id FROM message_send_requests WHERE user_id=? AND message_id IN ($marks)");
    $keys->execute(array_merge([$userId],$ids));
    $clientIds=$keys->fetchAll(PDO::FETCH_KEY_PAIR);
    $saved=db()->prepare("SELECT message_id FROM saved_messages WHERE user_id=? AND message_id IN ($marks)");
    $saved->execute(array_merge([$userId],$ids));
    $savedIds=array_flip($saved->fetchAll(PDO::FETCH_COLUMN));
    foreach ($messages as &$message) {
        $message['saved']=isset($savedIds[$message['id']]);
        $message['client_message_id']=$clientIds[$message['id']] ?? null;
    }
    unset($message);
}
