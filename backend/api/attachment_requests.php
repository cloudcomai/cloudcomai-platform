<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed',405);
$st=db()->prepare('SELECT r.id AS request_id,r.status,r.request_type,r.requested_at,a.id AS attachment_id,a.original_filename,a.mime_type,a.file_size,m.chat_id,m.sender_id,u.name AS requester_name FROM attachment_download_requests r JOIN message_attachments a ON a.id=r.attachment_id JOIN messages m ON m.id=a.message_id JOIN users u ON u.id=r.requester_id JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=r.sender_id AND cm.status="active" LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=cm.user_id LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=cm.user_id WHERE r.sender_id=? AND r.status="PENDING" AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP()) AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0 ORDER BY r.requested_at ASC LIMIT 100');
$st->execute([$user['id']]); out(['requests'=>$st->fetchAll()]);
