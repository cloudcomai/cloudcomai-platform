<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed', 405);

$pdo = db();
$profile = $pdo->prepare('SELECT id,user_id,name,email,mobile,dob,gender,email_verified,mobile_verified,account_status,created_at,updated_at FROM users WHERE id=?');
$profile->execute([$user['id']]);

$preferences = $pdo->prepare('SELECT interest,display_order,pinned,hidden,updated_at FROM user_interests WHERE user_id=? ORDER BY display_order,interest');
$preferences->execute([$user['id']]);

$blocks = $pdo->prepare('SELECT blocked_user_id,created_at FROM user_blocks WHERE user_id=? ORDER BY created_at');
$blocks->execute([$user['id']]);

$contacts = $pdo->prepare('SELECT display_name,given_name,family_name,email,phone,resource_name,updated_at FROM google_contacts WHERE user_id=? AND deleted_at IS NULL ORDER BY id');
$contacts->execute([$user['id']]);

$chats = $pdo->prepare(<<<'SQL'
    SELECT c.id,c.type,c.name,c.group_category,c.owner_id,c.retention_seconds,c.created_at,
           cm.role,cm.joined_at,COALESCE(cus.cleared_through_message_id,0) AS cleared_through_message_id
    FROM chats c
    INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=? AND cm.status='active'
    LEFT JOIN chat_user_states cus ON cus.chat_id=c.id AND cus.user_id=cm.user_id
    ORDER BY c.id
SQL);
$chats->execute([$user['id']]);

$messages = $pdo->prepare(<<<'SQL'
    SELECT m.id,m.chat_id,m.sender_id,m.type,m.body,m.reply_to_message_id,m.edit_count,m.edited_at,m.expires_at,m.created_at
    FROM messages m
    INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status='active'
    LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=cm.user_id
    LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=cm.user_id
    WHERE m.id>COALESCE(cus.cleared_through_message_id,0)
      AND m.deleted_for_everyone=0
      AND COALESCE(mus.hidden,0)=0
      AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())
    ORDER BY m.chat_id,m.id
SQL);
$messages->execute([$user['id']]);

$attachments = $pdo->prepare(<<<'SQL'
    SELECT a.id,a.message_id,m.chat_id,a.original_filename,a.mime_type,a.file_size,a.download_policy,a.created_at
    FROM message_attachments a
    INNER JOIN messages m ON m.id=a.message_id
    INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status='active'
    LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=cm.user_id
    LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=cm.user_id
    WHERE m.id>COALESCE(cus.cleared_through_message_id,0)
      AND m.deleted_for_everyone=0
      AND COALESCE(mus.hidden,0)=0
      AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())
    ORDER BY m.chat_id,m.id,a.id
SQL);
$attachments->execute([$user['id']]);

$exportedAt = gmdate('Y-m-d\TH:i:s\Z');
header('Cache-Control: private, no-store');
header('Content-Disposition: attachment; filename="cloudcomai-account-backup-' . gmdate('Ymd-His') . '.json"');
out([
    'format' => 'cloudcomai-account-backup',
    'version' => 1,
    'exported_at' => $exportedAt,
    'profile' => $profile->fetch(),
    'privacy_settings' => user_privacy_settings((int)$user['id']),
    'blocked_contacts' => $blocks->fetchAll(),
    'preferences' => $preferences->fetchAll(),
    'google_contacts' => $contacts->fetchAll(),
    'chats' => $chats->fetchAll(),
    'messages' => $messages->fetchAll(),
    'attachments' => $attachments->fetchAll(),
    'notes' => ['Attachment files are not embedded; attachment metadata is included.'],
]);
