<?php
require __DIR__ . '/../lib/bootstrap.php';

$viewer = auth_user();
$method = $_SERVER['REQUEST_METHOD'];
$targetUserId = (int)($_GET['user_id'] ?? input()['user_id'] ?? 0);
if ($targetUserId <= 0) fail('User id is required');
if ($targetUserId === (int)$viewer['id']) fail('You cannot trust yourself', 422);

$target = db()->prepare('SELECT id FROM users WHERE id=? AND account_status="active" LIMIT 1');
$target->execute([$targetUserId]);
if (!$target->fetchColumn()) fail('User not found', 404);

$blockState = users_block_state((int)$viewer['id'], $targetUserId);
if ($blockState['blocked']) fail('Trusted User is unavailable while either user is blocked', 403);

if ($method === 'GET') {
    $check = db()->prepare('SELECT 1 FROM trusted_users WHERE owner_user_id=? AND trusted_user_id=? LIMIT 1');
    $check->execute([(int)$viewer['id'], $targetUserId]);
    out(['trusted' => (bool)$check->fetchColumn(), 'owner_user_id' => (int)$viewer['id'], 'trusted_user_id' => $targetUserId]);
}

if ($method === 'POST' || $method === 'PUT') {
    $pdo = db();
    $pdo->prepare('INSERT INTO trusted_users(owner_user_id,trusted_user_id,created_at,updated_at) VALUES(?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE updated_at=UTC_TIMESTAMP()')->execute([(int)$viewer['id'], $targetUserId]);
    out(['trusted' => true, 'owner_user_id' => (int)$viewer['id'], 'trusted_user_id' => $targetUserId]);
}

if ($method === 'DELETE') {
    db()->prepare('DELETE FROM trusted_users WHERE owner_user_id=? AND trusted_user_id=?')->execute([(int)$viewer['id'], $targetUserId]);
    out(['trusted' => false, 'owner_user_id' => (int)$viewer['id'], 'trusted_user_id' => $targetUserId]);
}

fail('Method not allowed', 405);
