<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $st = $pdo->prepare("SELECT id,status,requested_at,completed_at FROM account_deletion_requests WHERE user_id=? ORDER BY id DESC LIMIT 1");
    $st->execute([(int)$user['id']]);
    $request = $st->fetch();
    out(['request' => $request ?: null]);
}

if ($method === 'POST') {
    $data = input();
    if (($data['confirmation'] ?? '') !== 'DELETE') fail('Type DELETE to confirm account deletion request');
    $pending = $pdo->prepare("SELECT id,status,requested_at FROM account_deletion_requests WHERE user_id=? AND status IN ('pending','processing') ORDER BY id DESC LIMIT 1");
    $pending->execute([(int)$user['id']]);
    if ($existing = $pending->fetch()) out(['request' => $existing, 'message' => 'Account deletion is already requested']);
    $st = $pdo->prepare("INSERT INTO account_deletion_requests(user_id,status,requested_at) VALUES(?,'pending',UTC_TIMESTAMP())");
    $st->execute([(int)$user['id']]);
    out(['request' => ['id' => (int)$pdo->lastInsertId(), 'status' => 'pending'], 'message' => 'Account deletion request received'], 202);
}

fail('Method not allowed', 405);
