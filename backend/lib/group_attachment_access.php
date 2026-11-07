<?php
declare(strict_types=1);

/**
 * Resolve explicit group attachment grants.
 *
 * A member-specific record takes precedence over a group-wide grant. An
 * explicitly revoked or expired record is a denial, not a signal to fall back
 * to legacy sender-approval/trusted-user policy. A missing record returns null
 * so installations that have never configured group access keep legacy policy.
 */
function group_attachment_permission_from_rows(?array $memberGrant, ?array $groupGrant, string $action, ?int $now = null): ?bool
{
    if (!in_array($action, ['download', 'forward'], true)) {
        throw new InvalidArgumentException('Unsupported attachment action');
    }

    $column = $action === 'download' ? 'download_enabled' : 'forward_enabled';
    $now ??= time();

    foreach ([$memberGrant, $groupGrant] as $grant) {
        if ($grant === null) continue;
        if ($grant['revoked_at'] !== null) return false;
        if ($grant['expires_at'] !== null && strtotime($grant['expires_at'] . ' UTC') <= $now) return false;
        return (bool)($grant[$column] ?? false);
    }

    return null;
}

/** Returns an explicit decision, or null when no group/member grant exists. */
function group_attachment_permission(int $chatId, int $userId, string $action): ?bool
{
    if (!in_array($action, ['download', 'forward'], true)) {
        throw new InvalidArgumentException('Unsupported attachment action');
    }

    $pdo = db();
    $member = $pdo->prepare('SELECT download_enabled,forward_enabled,expires_at,revoked_at FROM group_attachment_access WHERE chat_id=? AND grant_scope="member" AND member_id=? LIMIT 1');
    $member->execute([$chatId, $userId]);
    $memberGrant = $member->fetch() ?: null;

    $global = $pdo->prepare('SELECT download_enabled,forward_enabled,expires_at,revoked_at FROM group_attachment_access WHERE chat_id=? AND grant_scope="group" AND member_id=0 LIMIT 1');
    $global->execute([$chatId]);
    $groupGrant = $global->fetch() ?: null;

    return group_attachment_permission_from_rows($memberGrant, $groupGrant, $action);
}

/** Active group owners and admins bypass per-attachment sender approval for group attachments. */
function group_attachment_is_admin_or_owner(int $chatId, int $userId): bool
{
    $stmt = db()->prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status="active" AND role IN ("owner","admin") LIMIT 1');
    $stmt->execute([$chatId, $userId]);
    return (bool)$stmt->fetchColumn();
}
