<?php
require __DIR__ . '/../lib/bootstrap.php';

header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);

$d = input();
$token = is_string($d['token'] ?? null) ? trim($d['token']) : '';
$password = is_string($d['password'] ?? null) ? $d['password'] : '';

if ($token === '' || $password === '') fail('Reset token and new password are required');
if (!preg_match('/^[A-Za-z0-9_-]{43}$/D', $token)) fail('This reset link is invalid or has already been used.', 400);
if (!preg_match('/^.{8,}$/us', $password)) fail('Password must be at least 8 characters');
if (strlen($password) > 72 || str_contains($password, "\0")) fail('Password is too long or contains unsupported characters');

$pdo = db();
$st = $pdo->prepare('
    SELECT user_id
    FROM password_reset_tokens
    WHERE token_hash=?
      AND used_at IS NULL
      AND expires_at > UTC_TIMESTAMP()
    LIMIT 1
');
$tokenHash = hash('sha256', $token);
$st->execute([$tokenHash]);
$reset = $st->fetch();
if (!$reset) {
    $expired = $pdo->prepare('SELECT 1 FROM password_reset_tokens WHERE token_hash=? AND expires_at<=UTC_TIMESTAMP() LIMIT 1');
    $expired->execute([$tokenHash]);
    if ($expired->fetchColumn()) {
        fail('This password reset link has expired. Please request a new one.', 400);
    }
    fail('This reset link is invalid or has already been used.', 400);
}

try {
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->beginTransaction();
    $account = $pdo->prepare('SELECT account_status FROM users WHERE id=? FOR UPDATE');
    $account->execute([$reset['user_id']]);
    $status = $account->fetchColumn();
    // Recheck validity under the account lock: concurrent requests can consume a link only once.
    $locked = $pdo->prepare('SELECT id FROM password_reset_tokens WHERE token_hash=? AND user_id=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE');
    $locked->execute([$tokenHash, $reset['user_id']]);
    if ($status !== 'active' || !$locked->fetchColumn()) {
        $pdo->rollBack();
        fail('Reset link is invalid or expired. Request a new link.', 400);
    }
    $pdo->prepare('UPDATE users SET password_hash=?, updated_at=UTC_TIMESTAMP() WHERE id=?')
        ->execute([$passwordHash, $reset['user_id']]);
    $pdo->prepare('UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL')
        ->execute([$reset['user_id']]);
    $pdo->prepare('INSERT INTO user_session_versions(user_id,session_version) VALUES (?,1) ON DUPLICATE KEY UPDATE session_version=session_version+1')
        ->execute([$reset['user_id']]);
    $pdo->prepare('UPDATE notification_devices SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL')
        ->execute([$reset['user_id']]);
    $pdo->prepare('UPDATE user_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL')->execute([$reset['user_id']]);
    $pdo->commit();
    out(['message' => 'Password has been reset successfully']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('reset_password.php error: ' . $e->getMessage());
    fail('Unable to reset password', 500);
}
