<?php
require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user(); 
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $query = trim((string)($_GET['q'] ?? ''));

    if ($query === '') {
        out(['users' => []]);
    }

    $searchString = '%' . $query . '%';
    $st = db()->prepare('SELECT u.id,u.name,u.user_id FROM users u WHERE (u.name LIKE ? OR u.email LIKE ? OR u.user_id LIKE ?) AND u.id<>? AND u.account_status="active" AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.user_id=? AND ub.blocked_user_id=u.id) OR (ub.user_id=u.id AND ub.blocked_user_id=?)) ORDER BY LOWER(u.name),u.id LIMIT 15');
    $st->execute([$searchString, $searchString, $searchString, $user['id'], $user['id'], $user['id']]);
    
    out(['users' => $st->fetchAll()]);
}

fail('Method not allowed', 405);
