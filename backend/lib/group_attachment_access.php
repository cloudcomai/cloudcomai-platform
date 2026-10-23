<?php
declare(strict_types=1);

/** Returns true/false for an explicit group grant, or null when legacy policy applies. */
function group_attachment_permission(int $chatId, int $userId, string $action): ?bool
{
    if (!in_array($action, ['download', 'forward'], true)) {
        throw new InvalidArgumentException('Unsupported attachment action');
    }
    $column = $action === 'download' ? 'download_enabled' : 'forward_enabled';
    $pdo = db();
    $member = $pdo->prepare('SELECT download_enabled,forward_enabled,expires_at,revoked_at FROM group_attachment_access WHERE chat_id=? AND grant_scope="member" AND member_id=? LIMIT 1');
    $member->execute([$chatId, $userId]);
    $row = $member->fetch();
    if ($row) {
        if ($row['revoked_at'] !== null || ($row['expires_at'] !== null && strtotime($row['expires_at'] . ' UTC') <= time())) return false;
        return (bool)$row[$column];
    }
    $global = $pdo->prepare('SELECT download_enabled,forward_enabled,expires_at,revoked_at FROM group_attachment_access WHERE chat_id=? AND grant_scope="group" AND member_id=0 LIMIT 1');
    $global->execute([$chatId]);
    $row = $global->fetch();
    if (!$row) return null;
    if ($row['revoked_at'] !== null || ($row['expires_at'] !== null && strtotime($row['expires_at'] . ' UTC') <= time())) return false;
    return (bool)$row[$column];
}
