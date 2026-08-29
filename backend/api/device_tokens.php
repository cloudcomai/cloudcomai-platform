<?php
require __DIR__ . '/../lib/bootstrap.php';
$user = auth_user();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'DELETE') {
    db()->prepare('UPDATE notification_devices SET revoked_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL')->execute([$user['id']]);
    out(['ok' => true]);
}
if ($method !== 'POST') fail('Method not allowed', 405);
$input = read_json();
$token = trim((string)($input['token'] ?? ''));
$platform = strtoupper(trim((string)($input['platform'] ?? '')));
if ($token === '' || strlen($token) > 512 || !in_array($platform, ['ANDROID', 'IOS'], true)) fail('A valid token and platform are required', 422);
db()->prepare('INSERT INTO notification_devices (user_id, platform, token, revoked_at, created_at, updated_at) VALUES (?, ?, ?, NULL, UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), platform=VALUES(platform), revoked_at=NULL, updated_at=UTC_TIMESTAMP()')->execute([$user['id'], $platform, $token]);
out(['ok' => true, 'platform' => $platform]);
