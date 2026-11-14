<?php
declare(strict_types=1);

function mfa_log(string $step, array $context = []): void {
    $safe = [];
    foreach ($context as $key => $value) {
        if (in_array(strtolower((string)$key), ['otp', 'code', 'message', 'api_key', 'authorization', 'response_body', 'mobile', 'email'], true)) continue;
        if (is_scalar($value) || $value === null) $safe[$key] = $value;
    }
    error_log('[CloudComAI MFA] ' . $step . ($safe ? ' ' . json_encode($safe, JSON_UNESCAPED_SLASHES) : ''));
}

function mfa_is_enabled(): bool {
    global $config;
    return filter_var($config['app']['mfa_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
}

function otp_config(string $key, mixed $fallback = null): mixed {
    global $config;
    return $config['app']['otp'][$key] ?? $fallback;
}

function otp_hash_code(string $code): string {
    // OTP verification is independent of app.token_secret. Bcrypt slows offline
    // guessing if the OTP challenge table is exposed; OTPs remain short-lived
    // and protected by the per-challenge attempt limit.
    $hash = password_hash($code, PASSWORD_BCRYPT);
    if ($hash === false) {
        throw new RuntimeException('Unable to securely hash the verification code.');
    }
    return $hash;
}

function otp_code_matches(string $code, string $storedHash): bool {
    return password_verify($code, $storedHash);
}

function otp_send_sms_textbee(string $mobile, string $message): bool {
    global $config;
    $sms = $config['app']['otp']['sms'] ?? [];
    $apiKey = trim((string)($sms['api_key'] ?? ''));
    $deviceId = trim((string)($sms['device_id'] ?? ''));
    $url = trim((string)($sms['api_url'] ?? 'https://api.textbee.dev/api/v1/gateway/send-sms'));
    mfa_log('TextBee configuration checked', [
        'api_key_configured' => $apiKey !== '',
        'device_id_configured' => $deviceId !== '',
        'curl_available' => function_exists('curl_init'),
    ]);
    if ($apiKey === '' || $deviceId === '') {
        mfa_log('TextBee request skipped: credentials are missing', [
            'missing_api_key' => $apiKey === '',
            'missing_device_id' => $deviceId === '',
        ]);
        return false;
    }
    if (!function_exists('curl_init')) {
        mfa_log('TextBee request skipped: PHP cURL extension is unavailable');
        return false;
    }
    $payload = json_encode(['deviceId' => $deviceId, 'recipients' => [$mobile], 'message' => $message], JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        mfa_log('TextBee request skipped: payload JSON encoding failed', ['json_error' => json_last_error_msg()]);
        return false;
    }
    $ch = curl_init($url);
    if ($ch === false) {
        mfa_log('TextBee request skipped: cURL initialization failed');
        return false;
    }
    mfa_log('TextBee HTTP request starting');
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
    $curlErrno = curl_errno($ch);
    $curlError = curl_error($ch);
    curl_close($ch);
    if ($response === false) {
        mfa_log('TextBee transport failed', ['http_status' => $status, 'curl_errno' => $curlErrno, 'curl_error' => $curlError]);
        return false;
    }
    $decoded = json_decode((string)$response, true);
    if ($status >= 200 && $status < 300) {
        mfa_log('TextBee accepted the HTTP request', [
            'http_status' => $status,
            'response_json' => is_array($decoded),
            'response_fields' => is_array($decoded) ? array_slice(array_keys($decoded), 0, 12) : [],
        ]);
        return true;
    }
    mfa_log('TextBee rejected the HTTP request', [
        'http_status' => $status,
        'response_json' => is_array($decoded),
        'response_fields' => is_array($decoded) ? array_slice(array_keys($decoded), 0, 12) : [],
    ]);
    return false;
}

function otp_send_sms(string $mobile, string $message): bool {
    global $config;
    $provider = strtolower(trim((string)($config['app']['otp']['sms']['provider'] ?? '')));
    mfa_log('SMS provider selected', ['provider' => $provider !== '' ? $provider : 'not_set']);
    switch ($provider) {
        case 'textbee':
            $sent = otp_send_sms_textbee($mobile, $message);
            mfa_log('SMS provider completed', ['provider' => 'textbee', 'success' => $sent]);
            return $sent;
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
    mfa_log('OTP challenge creation started', ['purpose' => $purpose, 'user_id' => $userId]);
    $code = (string)random_int(100000, 999999);
    $challenge = random_token(32);
    $otpHash = otp_hash_code($code);
    $challengeHash = hash('sha256', $challenge);
    $ttl = max(60, min(900, (int)otp_config('ttl_seconds', 300)));
    $st = $pdo->prepare('INSERT INTO otp_challenges (challenge_hash,user_id,purpose,destination_email,destination_mobile,otp_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP() + INTERVAL ? SECOND,UTC_TIMESTAMP())');
    $st->execute([$challengeHash, $userId, $purpose, $email ?: null, $mobile ?: null, $otpHash, $ttl]);
    mfa_log('OTP challenge stored in database', ['purpose' => $purpose, 'user_id' => $userId, 'challenge_row_id' => (int)$pdo->lastInsertId()]);
    $message = "Your CloudComAI verification code is {$code}. It expires in " . (int)ceil($ttl / 60) . " minutes. Do not share it.";
    $emailSent = $email ? otp_send_email($email, $name, $code) : true;
    mfa_log('OTP email delivery completed', ['purpose' => $purpose, 'configured_destination' => (bool)$email, 'success' => $emailSent]);
    $smsSent = $mobile ? otp_send_sms($mobile, $message) : true;
    mfa_log('OTP SMS delivery completed', ['purpose' => $purpose, 'configured_destination' => (bool)$mobile, 'success' => $smsSent]);
    if (!$emailSent || !$smsSent) {
        $pdo->prepare('UPDATE otp_challenges SET consumed_at=UTC_TIMESTAMP() WHERE challenge_hash=?')->execute([$challengeHash]);
        mfa_log('OTP challenge marked consumed because a delivery channel failed', ['purpose' => $purpose, 'user_id' => $userId, 'email_sent' => $emailSent, 'sms_sent' => $smsSent]);
        throw new RuntimeException('Unable to deliver the verification code. Check email/SMS configuration and try again.');
    }
    mfa_log('OTP challenge creation and delivery completed', ['purpose' => $purpose, 'user_id' => $userId]);
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
        if (!otp_code_matches($code, (string)$row['otp_hash'])) {
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
