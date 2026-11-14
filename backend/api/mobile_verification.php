<?php
require __DIR__ . '/../lib/bootstrap.php';
header('Cache-Control: no-store');
$user = auth_user();
$d = input();
$action = (string)($d['action'] ?? '');
if ($action === 'request') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
    $mobile = normalize_mobile_identifier((string)($d['mobile'] ?? ''));
    if (!preg_match('/^\+?[0-9]{7,15}$/', $mobile)) fail('Enter a valid mobile number including country code', 422);
    $check = db()->prepare('SELECT id FROM users WHERE mobile=? AND id<>? LIMIT 1');
    $check->execute([$mobile, (int)$user['id']]);
    if ($check->fetch()) fail('Mobile number is already registered', 409);
    try {
        $challenge = create_otp_challenge((int)$user['id'], 'mobile_change', null, $mobile, (string)$user['name']);
    } catch (Throwable $e) {
        error_log('Mobile verification OTP could not be sent for user ' . (int)$user['id'] . ': ' . $e->getMessage());
        fail('Unable to send verification code. Please check SMS configuration and try again.', 503);
    }
    out(['challenge_id'=>$challenge,'message'=>'Verification code sent to the new mobile number.']);
}
if ($action === 'verify') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
    $challengeId = trim((string)($d['challenge_id'] ?? ''));
    $code = trim((string)($d['code'] ?? ''));
    if ($challengeId === '' || $code === '') fail('Challenge ID and verification code are required');
    $ownership = db()->prepare('SELECT user_id FROM otp_challenges WHERE challenge_hash=? AND purpose=? LIMIT 1');
    $ownership->execute([hash('sha256', $challengeId), 'mobile_change']);
    if ((int)$ownership->fetchColumn() !== (int)$user['id']) fail('Verification challenge does not belong to this account', 403);
    $row = verify_otp_challenge($challengeId, $code, 'mobile_change');
    if (!$row['destination_mobile']) fail('Verification challenge is invalid', 400);
    try {
        $st = db()->prepare('UPDATE users SET mobile=?,mobile_verified=1,updated_at=UTC_TIMESTAMP() WHERE id=?');
        $st->execute([$row['destination_mobile'], (int)$user['id']]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') fail('Mobile number is already registered', 409);
        throw $e;
    }
    out(['mobile'=>$row['destination_mobile'],'mobile_verified'=>true]);
}
fail('Unsupported action');
