<?php

require __DIR__ . '/../lib/bootstrap.php';

$user = auth_user();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

function privacy_boolean(array $data, string $key, bool $fallback): bool {
    if (!array_key_exists($key, $data)) return $fallback;
    $value = $data[$key];
    if (is_bool($value)) return $value;
    if ($value === 1 || $value === '1') return true;
    if ($value === 0 || $value === '0') return false;
    fail(str_replace('_', ' ', ucfirst($key)) . ' must be true or false');
}

function user_storage_summary(int $userId): array {
    $categories = [
        'images' => ['count' => 0, 'bytes' => 0],
        'audio' => ['count' => 0, 'bytes' => 0],
        'video' => ['count' => 0, 'bytes' => 0],
        'documents' => ['count' => 0, 'bytes' => 0],
    ];
    $st = db()->prepare(<<<'SQL'
        SELECT
            CASE
                WHEN m.type='voice' OR a.mime_type LIKE 'audio/%' THEN 'audio'
                WHEN m.type='video' OR a.mime_type LIKE 'video/%' THEN 'video'
                WHEN a.mime_type LIKE 'image/%' THEN 'images'
                ELSE 'documents'
            END AS category,
            COUNT(*) AS file_count,
            COALESCE(SUM(a.file_size),0) AS total_bytes
        FROM message_attachments a
        INNER JOIN messages m ON m.id=a.message_id
        WHERE m.sender_id=? AND m.deleted_for_everyone=0
        GROUP BY category
    SQL);
    $st->execute([$userId]);
    foreach ($st->fetchAll() as $row) {
        $category = (string)$row['category'];
        if (!isset($categories[$category])) continue;
        $categories[$category] = ['count' => (int)$row['file_count'], 'bytes' => (int)$row['total_bytes']];
    }
    $totalFiles = array_sum(array_column($categories, 'count'));
    $totalBytes = array_sum(array_column($categories, 'bytes'));
    return ['total_files' => $totalFiles, 'total_bytes' => $totalBytes, 'categories' => $categories];
}

if ($method === 'GET') {
    $blocked = $pdo->prepare(<<<'SQL'
        SELECT u.id,u.name,u.user_id,b.created_at
        FROM user_blocks b
        INNER JOIN users u ON u.id=b.blocked_user_id
        WHERE b.user_id=?
        ORDER BY LOWER(u.name),u.id
    SQL);
    $blocked->execute([$user['id']]);
    $blockedUsers = $blocked->fetchAll();
    foreach ($blockedUsers as &$blockedUser) $blockedUser['id'] = (int)$blockedUser['id'];
    unset($blockedUser);

    out([
        'settings' => user_privacy_settings((int)$user['id']),
        'blocked_users' => $blockedUsers,
        'storage' => user_storage_summary((int)$user['id']),
    ]);
}

if ($method === 'PUT') {
    $data = input();
    $current = user_privacy_settings((int)$user['id']);
    $settings = [
        'hide_online_status' => privacy_boolean($data, 'hide_online_status', $current['hide_online_status']),
        'media_auto_download' => privacy_boolean($data, 'media_auto_download', $current['media_auto_download']),
        'screenshot_alerts' => privacy_boolean($data, 'screenshot_alerts', $current['screenshot_alerts']),
    ];
    $st = $pdo->prepare(<<<'SQL'
        INSERT INTO user_privacy_settings(user_id,hide_online_status,media_auto_download,screenshot_alerts,updated_at)
        VALUES(?,?,?,?,UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
            hide_online_status=VALUES(hide_online_status),
            media_auto_download=VALUES(media_auto_download),
            screenshot_alerts=VALUES(screenshot_alerts),
            updated_at=UTC_TIMESTAMP()
    SQL);
    $st->execute([
        $user['id'],
        $settings['hide_online_status'] ? 1 : 0,
        $settings['media_auto_download'] ? 1 : 0,
        $settings['screenshot_alerts'] ? 1 : 0,
    ]);
    out(['settings' => $settings]);
}

if ($method === 'POST') {
    $data = input();
    $blockedUserId = (int)($data['user_id'] ?? 0);
    if ($blockedUserId <= 0 || $blockedUserId === (int)$user['id']) fail('A valid contact is required');
    $target = $pdo->prepare('SELECT id,name,user_id FROM users WHERE id=? AND account_status="active" LIMIT 1');
    $target->execute([$blockedUserId]);
    $blockedUser = $target->fetch();
    if (!$blockedUser) fail('Contact not found', 404);
    $pdo->prepare('INSERT IGNORE INTO user_blocks(user_id,blocked_user_id,created_at) VALUES(?,?,UTC_TIMESTAMP())')->execute([$user['id'], $blockedUserId]);
    out(['blocked_user' => [
        'id' => (int)$blockedUser['id'],
        'name' => $blockedUser['name'],
        'user_id' => $blockedUser['user_id'],
    ]], 201);
}

if ($method === 'DELETE') {
    $blockedUserId = (int)($_GET['user_id'] ?? 0);
    if ($blockedUserId <= 0) fail('Blocked contact id is required');
    $st = $pdo->prepare('DELETE FROM user_blocks WHERE user_id=? AND blocked_user_id=?');
    $st->execute([$user['id'], $blockedUserId]);
    out(['message' => 'Contact unblocked', 'user_id' => $blockedUserId]);
}

fail('Method not allowed', 405);
