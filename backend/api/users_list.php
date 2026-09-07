<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $st = db()->prepare('
        SELECT u.id, u.name, u.user_id,
               CASE WHEN u.updated_at IS NOT NULL AND u.updated_at >= UTC_TIMESTAMP() - INTERVAL 90 SECOND AND COALESCE(ups.hide_online_status,0)=0 THEN 1 ELSE 0 END AS online
        FROM users u
        LEFT JOIN user_privacy_settings ups ON ups.user_id=u.id
        WHERE u.id != ? AND u.account_status="active"
          AND NOT EXISTS (
              SELECT 1 FROM user_blocks ub
              WHERE (ub.user_id=? AND ub.blocked_user_id=u.id)
                 OR (ub.user_id=u.id AND ub.blocked_user_id=?)
          )
        LIMIT 100
    ');
    $st->execute([$user['id'], $user['id'], $user['id']]);
    $users = $st->fetchAll();
    foreach ($users as &$row) {
        $row['id'] = (int)$row['id'];
        $row['online'] = (bool)$row['online'];
    }
    unset($row);
    out(['users' => $users]);
}
fail('Method not allowed', 405);
