<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'DELETE') {
    $token = trim((string)(input()['token'] ?? $_GET['token'] ?? ''));
    if ($token === '') fail('Device token is required',422);
    db()->prepare('UPDATE notification_devices SET revoked_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP() WHERE user_id=? AND token=? AND revoked_at IS NULL')->execute([$user['id'],$token]);
    out(['ok' => true]);
}
if ($method !== 'POST') fail('Method not allowed', 405);
$input = input();
$token = trim((string)($input['token'] ?? ''));
$platform = strtoupper(trim((string)($input['platform'] ?? '')));
if ($token === '' || strlen($token) > 512 || !in_array($platform, ['ANDROID', 'IOS'], true)) fail('A valid token and platform are required', 422);
$pdo=db();
$pdo->beginTransaction();
$pdo->prepare('DELETE q FROM notification_delivery_queue q INNER JOIN notification_devices d ON d.id=q.device_id INNER JOIN notification_history h ON h.id=q.notification_id WHERE d.token=? AND h.user_id<>?')->execute([$token,$user['id']]);
$pdo->prepare('INSERT INTO notification_devices (user_id, platform, token, revoked_at, created_at, updated_at) VALUES (?, ?, ?, NULL, UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), platform=VALUES(platform), revoked_at=NULL, updated_at=UTC_TIMESTAMP()')->execute([$user['id'], $platform, $token]);
$pdo->prepare('INSERT INTO user_session_devices(device_id,session_id) SELECT id,? FROM notification_devices WHERE token=? AND user_id=? ON DUPLICATE KEY UPDATE session_id=VALUES(session_id)')->execute([$GLOBALS['authenticated_session_id'],$token,$user['id']]);
$pdo->commit();
out(['ok' => true, 'platform' => $platform]);
