<?php
declare(strict_types=1);
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/group_attachment_access.php';

$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) fail('Method not allowed', 405);
$pdo = db();
$userId = (int)$user['id'];

if ($method === 'GET') {
    $chatId = (int)($_GET['chat_id'] ?? 0);
    $owner = $pdo->prepare('SELECT owner_id FROM chats WHERE id=? AND type="group"');
    $owner->execute([$chatId]);
    if ((int)$owner->fetchColumn() !== $userId) fail('Only the group owner can manage attachment access', 403);
    $st = $pdo->prepare('SELECT grant_scope,member_id,download_enabled,forward_enabled,expires_at,revoked_at,updated_at FROM group_attachment_access WHERE chat_id=? ORDER BY grant_scope,member_id');
    $st->execute([$chatId]);
    out(['chat_id'=>$chatId,'grants'=>$st->fetchAll()]);
}

$data = input();
$chatId = (int)($data['chat_id'] ?? 0);
$action = (string)($data['action'] ?? '');
$pdo->beginTransaction();
try {
    $owner = $pdo->prepare('SELECT owner_id FROM chats WHERE id=? AND type="group" FOR UPDATE');
    $owner->execute([$chatId]);
    if ($chatId <= 0 || (int)$owner->fetchColumn() !== $userId) {
        $pdo->rollBack();
        fail('Only the group owner can manage attachment access', 403);
    }
    if (!in_array($action, ['grant_member','revoke_member','grant_group','revoke_group'], true)) {
        $pdo->rollBack();
        fail('Unsupported attachment access action', 422);
    }
    $scope = str_ends_with($action, '_member') ? 'member' : 'group';
    $memberId = $scope === 'member' ? (int)($data['user_id'] ?? 0) : 0;
    if ($scope === 'member') {
        $member = $pdo->prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=? AND status="active" AND user_id<>?');
        $member->execute([$chatId, $memberId, $userId]);
        if ($memberId <= 0 || !$member->fetchColumn()) {
            $pdo->rollBack();
            fail('Select an active group member other than the owner', 422);
        }
    }
    $grant = str_starts_with($action, 'grant_');
    $download = $grant && (($data['download'] ?? true) === true || ($data['download'] ?? 1) === 1) ? 1 : 0;
    $forward = $grant && (($data['forward'] ?? true) === true || ($data['forward'] ?? 1) === 1) ? 1 : 0;
    if ($grant && !$download && !$forward) {
        $pdo->rollBack();
        fail('Enable download, forwarding, or both', 422);
    }
    $expiresAt = null;
    if ($action === 'grant_group') {
        $hours = (int)($data['duration_hours'] ?? 24);
        if (!in_array($hours, [24, 48], true)) {
            $pdo->rollBack();
            fail('Group-wide access duration must be 24 or 48 hours', 422);
        }
        $expiresAt = gmdate('Y-m-d H:i:s', time() + $hours * 3600);
    }
    $revokedAt = $grant ? null : gmdate('Y-m-d H:i:s');
    $stmt = $pdo->prepare('INSERT INTO group_attachment_access(chat_id,grant_scope,member_id,download_enabled,forward_enabled,expires_at,revoked_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE download_enabled=VALUES(download_enabled),forward_enabled=VALUES(forward_enabled),expires_at=VALUES(expires_at),revoked_at=VALUES(revoked_at),created_by=VALUES(created_by),updated_at=UTC_TIMESTAMP()');
    $stmt->execute([$chatId,$scope,$memberId,$download,$forward,$expiresAt,$revokedAt,$userId]);
    $pdo->commit();
    out(['status'=>'ok','chat_id'=>$chatId,'scope'=>$scope,'user_id'=>$scope === 'member' ? $memberId : null,'download'=>(bool)$download,'forward'=>(bool)$forward,'expires_at'=>$expiresAt,'revoked'=>!$grant]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Group attachment access update failed: ' . $error->getMessage());
    fail('Unable to update group attachment access', 500);
}
