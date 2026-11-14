<?php
require __DIR__ . '/../lib/bootstrap.php';
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed', 405);
$d = input();
$challengeId = trim((string)($d['challenge_id'] ?? ''));
$code = trim((string)($d['code'] ?? ''));
if ($challengeId === '' || $code === '') fail('Challenge ID and verification code are required');
$purpose = (string)($d['purpose'] ?? '');
if (!in_array($purpose, ['registration', 'first_login'], true)) fail('Unsupported verification purpose');
$row = verify_otp_challenge($challengeId, $code, $purpose);
$userId = (int)($row['user_id'] ?? 0);
if ($userId <= 0) fail('Verification challenge is invalid', 400);
$pdo = db();
$pdo->beginTransaction();
try {
    if ($purpose === 'registration') {
        $pdo->prepare('UPDATE users SET email_verified=IF(email IS NULL,1,IF(? IS NULL,0,1)), mobile_verified=IF(mobile IS NULL,1,IF(? IS NULL,0,1)), updated_at=UTC_TIMESTAMP() WHERE id=?')
            ->execute([$row['destination_email'], $row['destination_mobile'], $userId]);
    } else {
        if ($row['destination_email']) $pdo->prepare('UPDATE users SET email_verified=1,updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([$userId]);
        if ($row['destination_mobile']) $pdo->prepare('UPDATE users SET mobile_verified=1,updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([$userId]);
    }
    $pdo->prepare('INSERT INTO user_mfa_state(user_id,first_login_verified_at) VALUES(?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE first_login_verified_at=COALESCE(first_login_verified_at,UTC_TIMESTAMP())')->execute([$userId]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
$st = $pdo->prepare('SELECT u.id,u.name,u.user_id,u.email,u.mobile,u.gender,COALESCE(s.session_version,0) AS session_version FROM users u LEFT JOIN user_session_versions s ON s.user_id=u.id WHERE u.id=? AND u.account_status="active" LIMIT 1');
$st->execute([$userId]);
$user = $st->fetch();
if (!$user) fail('Account unavailable', 403);
out(['token'=>token_for($userId,(int)$user['session_version']),'user'=>['id'=>$userId,'name'=>$user['name'],'user_id'=>$user['user_id'],'email'=>$user['email'],'mobile'=>$user['mobile'],'gender'=>$user['gender']]]);
