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
           AND shared_chat.type IN ("private","public")
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
        $imageVersion = (string)(filemtime($candidate) ?: 0) . '-' . (string)filesize($candidate);
        break;
    }
}

$visibility = user_privacy_settings($targetUserId);
$self = $targetUserId === (int)$viewer['id'];
$online = $self;
if (!$self) {
    $onlineQuery = db()->prepare('
        SELECT CASE WHEN u.updated_at IS NOT NULL
          AND u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND
          AND COALESCE(ups.hide_online_status,0)=0
        THEN 1 ELSE 0 END
        FROM users u
        LEFT JOIN user_privacy_settings ups ON ups.user_id=u.id
        WHERE u.id=?
        LIMIT 1
    ');
    $onlineQuery->execute([$targetUserId]);
    $online = (bool)$onlineQuery->fetchColumn();
}

$relationship = ['status' => $self ? 'self' : 'none'];
if (!$self) {
    $relationshipStmt = db()->prepare('
        SELECT status, requester_id, recipient_id
        FROM friend_requests
        WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)
        ORDER BY id DESC
        LIMIT 1
    ');
    $relationshipStmt->execute([(int)$viewer['id'], $targetUserId, $targetUserId, (int)$viewer['id']]);
    if ($request = $relationshipStmt->fetch()) {
        $relationship = [
            'status' => (string)$request['status'],
            'direction' => (int)$request['requester_id'] === (int)$viewer['id'] ? 'outgoing' : 'incoming',
        ];
    }
}

out(['user' => [
    'id' => (int)$profile['id'],
    'name' => $profile['name'],
    'user_id' => $profile['user_id'],
    'age' => ($self || $visibility['share_age']) ? age_from_dob((string)$profile['dob']) : null,
    'gender' => ($self || $visibility['share_gender']) ? $profile['gender'] : null,
    'email' => ($self || $visibility['share_email']) ? ($profile['email'] ?: null) : null,
    'mobile' => ($self || $visibility['share_mobile']) ? ($profile['mobile'] ?: null) : null,
    'hidden_fields' => $self ? [] : array_values(array_map(static fn($key) => substr($key,6),array_keys(array_filter($visibility,static fn($value,$key) => str_starts_with($key,'share_') && !$value,ARRAY_FILTER_USE_BOTH)))),
    'image_version' => $imageVersion,
    'online' => $online,
    'relationship' => $relationship,
]]);
