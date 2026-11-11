<?php
declare(strict_types=1);

/**
 * Isolated access-control helpers for Moments/Stories.
 * These tables are created idempotently so existing MySQL installations upgrade safely.
 */
function ensure_story_privacy_tables(): void
{
    static $ready = false;
    if ($ready) return;
    db()->exec('CREATE TABLE IF NOT EXISTS story_groups (
        story_id BIGINT UNSIGNED NOT NULL,
        chat_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (story_id, chat_id),
        INDEX idx_story_groups_chat_story (chat_id, story_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS user_story_hidden_contacts (
        user_id BIGINT UNSIGNED NOT NULL,
        hidden_user_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, hidden_user_id),
        INDEX idx_story_hidden_contact (hidden_user_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $ready = true;
}

function story_contact_relationship(int $ownerId, int $viewerId): bool
{
    if ($ownerId === $viewerId) return true;
    $friend = db()->prepare('SELECT 1 FROM friend_requests WHERE status="accepted" AND ((requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)) LIMIT 1');
    $friend->execute([$ownerId, $viewerId, $viewerId, $ownerId]);
    if ($friend->fetchColumn()) return true;
    // Preserve visibility for existing private conversations created before friend requests existed.
    $private = db()->prepare('SELECT 1 FROM chats c
        INNER JOIN chat_members owner_member ON owner_member.chat_id=c.id AND owner_member.user_id=? AND owner_member.status="active"
        INNER JOIN chat_members viewer_member ON viewer_member.chat_id=c.id AND viewer_member.user_id=? AND viewer_member.status="active"
        WHERE c.type="private" LIMIT 1');
    $private->execute([$ownerId, $viewerId]);
    if ($private->fetchColumn()) return true;

    // Match registered users against the owner's saved Google/phone contacts.
    $saved = db()->prepare('SELECT 1 FROM users target
        WHERE target.id=? AND (
            EXISTS (SELECT 1 FROM google_contacts gc WHERE gc.user_id=? AND target.email IS NOT NULL AND LOWER(gc.email)=LOWER(target.email))
            OR EXISTS (SELECT 1 FROM phone_contacts pc WHERE pc.user_id=? AND target.email IS NOT NULL AND LOWER(pc.email)=LOWER(target.email))
            OR EXISTS (SELECT 1 FROM phone_contacts pc WHERE pc.user_id=? AND target.mobile IS NOT NULL AND pc.phone=target.mobile)
        ) LIMIT 1');
    $saved->execute([$viewerId, $ownerId, $ownerId, $ownerId]);
    return (bool)$saved->fetchColumn();
}

function can_view_story(int $storyId, int $viewerId): bool
{
    ensure_story_privacy_tables();
    $stmt = db()->prepare('SELECT id,user_id,audience,expires_at,deleted_at FROM stories WHERE id=? LIMIT 1');
    $stmt->execute([$storyId]);
    $story = $stmt->fetch();
    if (!$story || $story['deleted_at'] !== null || strtotime((string)$story['expires_at'] . ' UTC') <= time()) return false;
    $ownerId = (int)$story['user_id'];
    if ($ownerId === $viewerId) return true;

    $blocked = db()->prepare('SELECT 1 FROM user_blocks WHERE (user_id=? AND blocked_user_id=?) OR (user_id=? AND blocked_user_id=?) LIMIT 1');
    $blocked->execute([$ownerId, $viewerId, $viewerId, $ownerId]);
    if ($blocked->fetchColumn()) return false;

    $hidden = db()->prepare('SELECT 1 FROM user_story_hidden_contacts WHERE user_id=? AND hidden_user_id=? LIMIT 1');
    $hidden->execute([$ownerId, $viewerId]);
    if ($hidden->fetchColumn()) return false;

    $audience = (string)$story['audience'];
    if ($audience === 'public') return true;
    if ($audience === 'contacts') {
        $friend = db()->prepare('SELECT 1 FROM friend_requests WHERE status="accepted" AND ((requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)) LIMIT 1');
        $friend->execute([$ownerId, $viewerId, $viewerId, $ownerId]);
        return (bool)$friend->fetchColumn();
    }
    if ($audience === 'groups') {
        $group = db()->prepare('SELECT 1 FROM story_groups sg
            INNER JOIN chat_members viewer ON viewer.chat_id=sg.chat_id AND viewer.user_id=? AND viewer.status="active"
            INNER JOIN chat_members owner_member ON owner_member.chat_id=sg.chat_id AND owner_member.user_id=? AND owner_member.status="active"
            INNER JOIN chats c ON c.id=sg.chat_id AND c.type="group"
            WHERE sg.story_id=? LIMIT 1');
        $group->execute([$viewerId, $ownerId, $storyId]);
        return (bool)$group->fetchColumn();
    }
    // Backwards-compatible visibility for legacy stories.
    return $audience === 'friends' && story_contact_relationship($ownerId, $viewerId);
}
