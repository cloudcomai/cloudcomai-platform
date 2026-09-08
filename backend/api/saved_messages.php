<?php
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/message_payload.php';
$user=auth_user();
$pdo=db();
$method=$_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    $id=(int)(input()['message_id'] ?? 0);
    assert_visible_message($id,(int)$user['id']);
    $pdo->prepare('INSERT IGNORE INTO saved_messages(user_id,message_id) VALUES(?,?)')->execute([$user['id'],$id]);
    out(['message_id'=>$id,'saved'=>true]);
}
if ($method === 'DELETE') {
    $id=(int)($_GET['message_id'] ?? 0);
    if ($id<1) fail('Message id is required',422);
    $pdo->prepare('DELETE FROM saved_messages WHERE user_id=? AND message_id=?')->execute([$user['id'],$id]);
    out(['message_id'=>$id,'saved'=>false]);
}
if ($method !== 'GET') fail('Method not allowed',405);
$before=max(0,(int)($_GET['before_id'] ?? 0));
$limit=max(1,min(100,(int)($_GET['limit'] ?? 50)));
$sql=<<<'SQL'
    SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.created_at,m.expires_at,m.edit_count,m.edited_at,
        s.id AS saved_id,s.saved_at,u.name AS sender_name,c.name AS chat_name
    FROM saved_messages s
    INNER JOIN messages m ON m.id=s.message_id
    INNER JOIN users u ON u.id=m.sender_id
    INNER JOIN chats c ON c.id=m.chat_id
    INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=s.user_id AND cm.status='active'
    LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=s.user_id
    LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=s.user_id
    WHERE s.user_id=? AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())
        AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0
SQL;
$params=[$user['id']];
if ($before) { $sql.=' AND s.id<?'; $params[]=$before; }
$st=$pdo->prepare($sql." ORDER BY s.id DESC LIMIT $limit"); $st->execute($params);
$messages=$st->fetchAll();
hydrate_message_attachments($messages); hydrate_message_polls($messages,(int)$user['id']);
out(['messages'=>$messages,'next_before_id'=>count($messages)===$limit ? (int)end($messages)['saved_id'] : null]);
