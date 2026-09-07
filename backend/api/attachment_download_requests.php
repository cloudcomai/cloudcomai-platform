<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$chat = (int)($_GET['chat_id'] ?? 0);
if ($chat <= 0) fail('Invalid chat');

$st = db()->prepare('SELECT r.id AS request_id,r.attachment_id,r.requester_id,r.status,r.requested_at,a.original_filename,a.mime_type,m.id AS message_id FROM attachment_download_requests r JOIN message_attachments a ON a.id=r.attachment_id JOIN messages m ON m.id=a.message_id JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=r.sender_id AND cm.status="active" LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=cm.user_id LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=cm.user_id WHERE m.chat_id=? AND r.sender_id=? AND r.status="PENDING" AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0 ORDER BY r.requested_at ASC');
$st->execute([$chat, $user['id']]);
out(['requests' => $st->fetchAll()]);
