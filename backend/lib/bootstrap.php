<?php
declare(strict_types=1);

$configFile = __DIR__ . '/../config/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Backend is not configured. Copy config.example.php to config.php.']);
    exit;
}
$config = require $configFile;

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $config['app']['allowed_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Idempotency-Key');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function db(): PDO {
    global $config;
    static $pdo;
    if (!$pdo) {
        $d = $config['db'];
        $dsn = "mysql:host={$d['host']};dbname={$d['name']};charset={$d['charset']}";
        $pdo = new PDO($dsn, $d['user'], $d['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}
function input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}
function out(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $message, int $status = 400): never { out(['message' => $message], $status); }
function queue_user_notification(int $userId, string $category, string $title, string $body, array $data = [], bool $deliverPush = true): int {
    $pdo = db();
    $text = trim($body);
    $text = function_exists('mb_substr') ? mb_substr($text, 0, 500) : substr($text, 0, 500);
    $insert = $pdo->prepare('INSERT INTO notification_history (user_id, category, title, body, data_json, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())');
    $insert->execute([$userId, $category, $title, $text, json_encode($data, JSON_UNESCAPED_SLASHES)]);
    $notificationId = (int)$pdo->lastInsertId();
    if ($deliverPush) {
        $devices = $pdo->prepare('SELECT id FROM notification_devices WHERE user_id=? AND revoked_at IS NULL');
        $devices->execute([$userId]);
        $queue = $pdo->prepare('INSERT IGNORE INTO notification_delivery_queue (notification_id, device_id) VALUES (?, ?)');
        foreach ($devices->fetchAll(PDO::FETCH_COLUMN) as $deviceId) $queue->execute([$notificationId, (int)$deviceId]);
    }
    return $notificationId;
}
function create_chat_notifications(int $chatId, int $senderId, string $senderName, string $body, int $messageId): void {
    $st = db()->prepare('SELECT user_id FROM chat_members WHERE chat_id=? AND user_id<>? AND status="active"');
    $st->execute([$chatId, $senderId]);
    $text = trim($body); if ($text === '') $text = 'Sent you an attachment';
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $recipientId) {
        $mute = db()->prepare('SELECT notifications_muted FROM chat_user_states WHERE chat_id=? AND user_id=? LIMIT 1');
        $mute->execute([$chatId, (int)$recipientId]);
        $muted = (bool)$mute->fetchColumn();
        queue_user_notification((int)$recipientId, 'message', $senderName, $text, [
            'category' => 'message',
            'chat_id' => $chatId,
            'message_id' => $messageId,
        ], !$muted);
    }
}
function user_privacy_settings(int $userId): array {
    $st = db()->prepare('SELECT hide_online_status,media_auto_download,screenshot_alerts FROM user_privacy_settings WHERE user_id=? LIMIT 1');
    $st->execute([$userId]);
    $row = $st->fetch() ?: [];
    return [
        'hide_online_status' => (bool)($row['hide_online_status'] ?? false),
        'media_auto_download' => (bool)($row['media_auto_download'] ?? false),
        'screenshot_alerts' => !array_key_exists('screenshot_alerts', $row) || (bool)$row['screenshot_alerts'],
    ];
}
function users_block_state(int $viewerId, int $otherUserId): array {
    $st = db()->prepare('SELECT user_id,blocked_user_id FROM user_blocks WHERE (user_id=? AND blocked_user_id=?) OR (user_id=? AND blocked_user_id=?)');
    $st->execute([$viewerId, $otherUserId, $otherUserId, $viewerId]);
    $blockedByMe = false;
    $blockedMe = false;
    foreach ($st->fetchAll() as $row) {
        if ((int)$row['user_id'] === $viewerId) $blockedByMe = true;
        if ((int)$row['user_id'] === $otherUserId) $blockedMe = true;
    }
    return ['blocked_by_me' => $blockedByMe, 'blocked_me' => $blockedMe, 'blocked' => $blockedByMe || $blockedMe];
}
function assert_chat_allows_messages(int $chatId, int $userId): void {
    $st = db()->prepare('SELECT c.type,cm.user_id FROM chats c INNER JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id<>? AND cm.status="active" WHERE c.id=? LIMIT 1');
    $st->execute([$userId, $chatId]);
    $chat = $st->fetch();
    if (!$chat || $chat['type'] !== 'private') return;
    if (users_block_state($userId, (int)$chat['user_id'])['blocked']) {
        fail('Messages are unavailable because this contact is blocked', 403);
    }
}
function token_for(int $userId, int $sessionVersion = 0): string {
    global $config;
    $payload = $userId . '|' . time() . '|' . bin2hex(random_bytes(12)) . '|' . $sessionVersion;
    $sig = hash_hmac('sha256', $payload, $config['app']['token_secret']);
    return base64_encode($payload . '|' . $sig);
}
function assert_visible_message(int $messageId, int $userId): void {
    $st = db()->prepare('SELECT m.id FROM messages m INNER JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=? AND cm.status="active" LEFT JOIN chat_user_states cus ON cus.chat_id=m.chat_id AND cus.user_id=cm.user_id LEFT JOIN message_user_states mus ON mus.message_id=m.id AND mus.user_id=cm.user_id WHERE m.id=? AND m.id>COALESCE(cus.cleared_through_message_id,0) AND COALESCE(mus.hidden,0)=0 AND m.deleted_for_everyone=0 AND (m.expires_at IS NULL OR m.expires_at>UTC_TIMESTAMP())');
    $st->execute([$userId, $messageId]);
    if (!$st->fetch()) fail('Message not found', 404);
}
function auth_user(): array {
    global $config;
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            $header = $headers['Authorization']
                ?? $headers['authorization']
                ?? '';
        }
    }
    if (!preg_match('/Bearer\s+(.+)/i', $header, $m)) fail('Authentication required', 401);
    $decoded = base64_decode($m[1], true);
    if (!$decoded) fail('Invalid token', 401);
    $parts = explode('|', $decoded);
    // Existing four-part tokens remain valid until that account resets its password.
    if (count($parts) === 4) {
        [$uid,$issued,$nonce,$sig] = $parts;
        $sessionVersion = '0';
    } elseif (count($parts) === 5) {
        [$uid,$issued,$nonce,$sessionVersion,$sig] = $parts;
    } else {
        fail('Invalid token', 401);
    }
    $payload = implode('|', array_slice($parts, 0, -1));
    $expected = hash_hmac('sha256', $payload, $config['app']['token_secret']);
    if (!hash_equals($expected, $sig)) fail('Invalid token', 401);
    if ((int)$issued < time() - 60*60*24*30) fail('Token expired', 401);
    if (!ctype_digit($sessionVersion)) fail('Invalid token', 401);
    $st = db()->prepare('SELECT u.id, u.user_id, u.name, u.email, u.mobile, u.gender, u.account_status, COALESCE(s.session_version,0) AS session_version FROM users u LEFT JOIN user_session_versions s ON s.user_id=u.id WHERE u.id=?');
    $st->execute([(int)$uid]);
    $user = $st->fetch();
    if (!$user || $user['account_status'] !== 'active') fail('Account unavailable', 401);
    if ((int)$sessionVersion !== (int)$user['session_version']) fail('Password changed. Please sign in again.', 401);
    unset($user['session_version']);
    return $user;
}
function chat_retention_seconds(string $chatType): int {
    global $config;

    $fallbacks = [
        'private' => 30 * 24 * 60 * 60,
        'group' => 30 * 24 * 60 * 60,
        'public' => 4 * 60 * 60,
    ];

    if (!array_key_exists($chatType, $fallbacks)) {
        throw new InvalidArgumentException("Unsupported chat type for retention: {$chatType}");
    }

    $configured = $config['app']['retention'][$chatType] ?? null;
    if (is_numeric($configured)) {
        $seconds = (int)$configured;
        if ($seconds > 0) return $seconds;
    }

    return $fallbacks[$chatType];
}
function normalize_mobile_identifier(string $mobile): string {
    $mobile = trim($mobile);
    if ($mobile === '') return '';
    $normalized = preg_replace('/[\s().-]+/', '', $mobile);
    return is_string($normalized) ? $normalized : $mobile;
}
function age_from_dob(string $dob): int {
    try { return (new DateTime($dob))->diff(new DateTime('today'))->y; }
    catch (Throwable $e) { return -1; }
}
function random_token(int $bytes=32): string { return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '='); }
