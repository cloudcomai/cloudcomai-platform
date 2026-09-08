<?php

require __DIR__ . '/../lib/bootstrap.php';

$viewer = auth_user();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed', 405);

$targetUserId = (int)($_GET['id'] ?? 0);
if ($targetUserId <= 0) fail('User id is required');

if ($targetUserId !== (int)$viewer['id']) {
    if (users_block_state((int)$viewer['id'], $targetUserId)['blocked']) {
        fail('This profile is unavailable', 403);
    }

    $sharedConversation = db()->prepare('
        SELECT 1
        FROM chat_members viewer_membership
        INNER JOIN chats shared_chat
            ON shared_chat.id=viewer_membership.chat_id
           AND shared_chat.type="private"
        INNER JOIN chat_members target_membership
            ON target_membership.chat_id=viewer_membership.chat_id
           AND target_membership.user_id=?
           AND target_membership.status="active"
        WHERE viewer_membership.user_id=?
          AND viewer_membership.status="active"
        LIMIT 1
    ');
    $sharedConversation->execute([$targetUserId, $viewer['id']]);
    if (!$sharedConversation->fetchColumn()) fail('This profile is unavailable', 403);
}

$query = db()->prepare('
    SELECT id,name,user_id,email,mobile,dob,gender,updated_at
    FROM users
    WHERE id=? AND account_status="active"
    LIMIT 1
');
$query->execute([$targetUserId]);
$profile = $query->fetch();
if (!$profile) fail('User not found', 404);

$imageVersion = null;
$folder = dirname(__DIR__) . '/uploads/users';
foreach (glob($folder . '/' . $targetUserId . '.*') ?: [] as $candidate) {
    if (is_file($candidate)) {
        $imageVersion = filemtime($candidate) ?: null;
        break;
    }
}

out(['user' => [
    'id' => (int)$profile['id'],
    'name' => $profile['name'],
    'user_id' => $profile['user_id'],
    'age' => age_from_dob((string)$profile['dob']),
    'gender' => $profile['gender'],
    'email' => $profile['email'] ?: null,
    'mobile' => $profile['mobile'] ?: null,
    'image_version' => $imageVersion,
]]);
