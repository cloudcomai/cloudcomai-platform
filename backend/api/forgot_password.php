<?php
require __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/password_recovery.php';

header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);

$d = input();
$identifier = is_string($d['identifier'] ?? null) ? strtolower(trim($d['identifier'])) : '';
if ($identifier === '') fail('Email, mobile or User ID is required');
if (strlen($identifier) > 190) fail('Email, mobile or User ID is too long');

$pdo = db();
try {
    global $config;
    // Validate deployment configuration for every request, including unknown accounts.
    $webBaseUrl = password_reset_web_url($config['app']['web_url'] ?? '');
    $mailFrom = trim((string)($config['app']['mail_from'] ?? ''));
    if (!filter_var($mailFrom, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $mailFrom)) {
        throw new RuntimeException('Configure app.mail_from with a valid sender mailbox');
    }

    $pdo->beginTransaction();
    // Serialize requests and resets for this account, including differently formatted identifiers.
    $st = $pdo->prepare('SELECT id, name, email, account_status FROM users WHERE email=? OR mobile=? OR user_id=? LIMIT 1 FOR UPDATE');
    $st->execute([$identifier, normalize_mobile_identifier($identifier), $identifier]);
    $user = $st->fetch();
    if (!$user || $user['account_status'] !== 'active' || !filter_var($user['email'], FILTER_VALIDATE_EMAIL)) {
        $pdo->commit();
        password_recovery_response();
    }

    $recent = $pdo->prepare('SELECT COUNT(*) AS hourly, COALESCE(SUM(created_at > UTC_TIMESTAMP() - INTERVAL 1 MINUTE),0) AS cooldown FROM password_reset_tokens WHERE user_id=? AND created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR');
    $recent->execute([$user['id']]);
    $limits = $recent->fetch();
    if ((int)$limits['cooldown'] > 0 || (int)$limits['hourly'] >= 5) {
        $pdo->commit();
        password_recovery_response();
    }
    $pdo->prepare('DELETE FROM password_reset_tokens WHERE user_id=? AND expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY')->execute([$user['id']]);

    $rawToken = random_token(32);
    $tokenHash = hash('sha256', $rawToken);
    $expiresAt = gmdate('Y-m-d H:i:s', time() + 1800);

    $insert = $pdo->prepare('INSERT INTO password_reset_tokens(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,UTC_TIMESTAMP())');
    $insert->execute([$user['id'], $tokenHash, $expiresAt]);
    $resetId = (int)$pdo->lastInsertId();
    $pdo->commit();

    // A fragment keeps the token out of web-server request logs and referrer URLs.
    $resetUrl = $webBaseUrl . '/#reset_token=' . rawurlencode($rawToken);

    $subject = 'CloudComAI password reset';
    $body = "Hello {$user['name']},\n\nUse the link below to reset your CloudComAI password:\n{$resetUrl}\n\nThis link expires in 30 minutes.\n\nIf you did not request this, you can ignore this email.";

    $headers = "From: CloudComAI <{$mailFrom}>\r\n";
    $headers .= "Reply-To: {$mailFrom}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    // The envelope sender helps shared/cPanel hosting accept and deliver mail from the
    // same domain as the From address. No SMTP credentials are stored in the repository.
    $mailResult = @mail($user['email'], $subject, $body, $headers, '-f' . escapeshellarg($mailFrom));
    if (!$mailResult) {
        $pdo->prepare('UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE id=?')->execute([$resetId]);
        error_log('Password reset mail transport failed for user ' . $user['id']);
    }

    password_recovery_response();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('forgot_password.php error: ' . $e->getMessage());
    fail('Unable to process password reset request', 500);
}
