<?php
declare(strict_types=1);

function mfa_is_enabled(): bool {
    global $config;
    return filter_var($config['app']['mfa_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
}

function otp_config(string $key, mixed $fallback = null): mixed {
    global $config;
    return $config['app']['otp'][$key] ?? $fallback;
}

function otp_send_sms_textbee(string $mobile, string $message): bool {
    global $config;
    $sms = $config['app']['otp']['sms'] ?? [];
    $apiKey = trim((string)($sms['api_key'] ?? ''));
    $deviceId = trim((string)($sms['device_id'] ?? ''));
    $url = trim((string)($sms['api_url'] ?? 'https://api.textbee.dev/api/v1/gateway/send-sms'));
    if ($apiKey === '' || $deviceId === '' || !function_exists('curl_init')) return false;
    $payload = json_encode(['deviceId' => $deviceId, 'recipients' => [$mobile], 'message' => $message], JSON_UNESCAPED_SLASHES);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . $apiKey],
        CURLOPT_POSTFIELDS => $payload,
    ]);
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $response !== false && $status >= 200 && $status < 300;
}

function otp_send_sms(string $mobile, string $message): bool {
    global $config;
    $provider = strtolower(trim((string)($config['app']['otp']['sms']['provider'] ?? '')));
    switch ($provider) {
        case 'textbee':
            return otp_send_sms_textbee($mobile, $message);
        default:
            error_log('Unsupported OTP SMS provider configured: ' . ($provider !== '' ? $provider : 'not_set'));
            return false;
    }
}

function otp_send_email(string $email, string $name, string $code): bool {
    global $config;
    $from = trim((string)($config['app']['mail_from'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) return false;
    $subject = 'Your CloudComAI verification code';
    $body = "Hello {$name},\n\nYour CloudComAI verification code is {$code}. It expires shortly. Do not share this code with anyone.\n";
    $headers = "From: CloudComAI <{$from}>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    return @mail($email, $subject, $body, $headers, '-f' . escapeshellarg($from));
}

function create_otp_challenge(?int $userId, string $purpose, ?string $email, ?string $mobile, string $name): string {
    global $config;
    if (!in_array($purpose, ['registration', 'first_login', 'mobile_change'], true)) {
        throw new InvalidArgumentException('Unsupported OTP purpose');
    }
    if (($email === null || $email === '') && ($mobile === null || $mobile === '')) {
        throw new RuntimeException('No verified delivery destination is available');
    }
    $pdo = db();
    $where = [];
    $params = [];
    if ($userId !== null) { $where[] = 'user_id=?'; $params[] = $userId; }
    if ($email) { $where[] = 'destination_email=?'; $params[] = $email; }
    if ($mobile) { $where[] = 'destination_mobile=?'; $params[] = $mobile; }
    if ($where) {
        $rate = $pdo->prepare('SELECT COUNT(*) FROM otp_challenges WHERE (' . implode(' OR ', $where) . ') AND created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR');
        $rate->execute($params);
        if ((int)$rate->fetchColumn() >= (int)otp_config('max_sends_per_hour', 5)) {
            throw new RuntimeException('OTP request limit reached. Please try again later.');
        }
        $cooldown = $pdo->prepare('SELECT created_at FROM otp_challenges WHERE (' . implode(' OR ', $where) . ') ORDER BY id DESC LIMIT 1');
        $cooldown->execute($params);
        $last = $cooldown->fetchColumn();
        if ($last && strtotime((string)$last . ' UTC') > time() - (int)otp_config('resend_cooldown_seconds', 60)) {
            throw new RuntimeException('Please wait before requesting another code.');
        }
    }
    $code = (string)random_int(100000, 999999);
    $challenge = random_token(32);
    $secret = (string)($config['app']['token_secret'] ?? '');
    if (strlen($secret) < 32) throw new RuntimeException('OTP signing secret is not configured');
    $otpHash = hash_hmac('sha256', $code, $secret);
    $challengeHash = hash('sha256', $challenge);
    $ttl = max(60, min(900, (int)otp_config('ttl_seconds', 300)));
    $st = $pdo->prepare('INSERT INTO otp_challenges (challenge_hash,user_id,purpose,destination_email,destination_mobile,otp_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP() + INTERVAL ? SECOND,UTC_TIMESTAMP())');
    $st->execute([$challengeHash, $userId, $purpose, $email ?: null, $mobile ?: null, $otpHash, $ttl]);
    $message = "Your CloudComAI verification code is {$code}. It expires in " . (int)ceil($ttl / 60) . " minutes. Do not share it.";
    $emailSent = $email ? otp_send_email($email, $name, $code) : true;
    $smsSent = $mobile ? otp_send_sms($mobile, $message) : true;
    if (!$emailSent || !$smsSent) {
        $pdo->prepare('UPDATE otp_challenges SET consumed_at=UTC_TIMESTAMP() WHERE challenge_hash=?')->execute([$challengeHash]);
        error_log('OTP delivery failed for challenge ' . substr($challengeHash, 0, 12));
        throw new RuntimeException('Unable to deliver the verification code. Check email/SMS configuration and try again.');
    }
    return $challenge;
}

function verify_otp_challenge(string $challenge, string $code, string $purpose): array {
    global $config;
    if (!preg_match('/^[0-9]{6}$/', $code)) fail('Invalid verification code', 400);
    $hash = hash('sha256', $challenge);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT * FROM otp_challenges WHERE challenge_hash=? AND purpose=? LIMIT 1 FOR UPDATE');
        $st->execute([$hash, $purpose]);
        $row = $st->fetch();
        if (!$row || $row['consumed_at'] !== null || strtotime((string)$row['expires_at'] . ' UTC') <= time()) {
            $pdo->commit();
            fail('Verification code is invalid or expired', 400);
        }
        $maxAttempts = max(1, min(10, (int)otp_config('max_attempts', 5)));
        if ((int)$row['attempts'] >= $maxAttempts) {
            $pdo->commit();
            fail('Too many incorrect attempts. Request a new code.', 429);
        }
        $expected = hash_hmac('sha256', $code, (string)$config['app']['token_secret']);
        if (!hash_equals((string)$row['otp_hash'], $expected)) {
            $pdo->prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?')->execute([$row['id']]);
            $pdo->commit();
            fail('Invalid verification code', 400);
        }
        $pdo->prepare('UPDATE otp_challenges SET consumed_at=UTC_TIMESTAMP() WHERE id=?')->execute([$row['id']]);
        $pdo->commit();
        return $row;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
