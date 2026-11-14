<?php
require __DIR__ . '/../lib/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed',405);
$d=input(); $identifier=trim((string)($d['identifier']??'')); $mobileIdentifier=normalize_mobile_identifier($identifier); $password=(string)($d['password']??'');
mfa_log('Login request received', ['identifier_type' => filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : (preg_match('/^[+0-9() .-]+$/', $identifier) ? 'mobile' : 'user_id')]);
if ($identifier===''||$password==='') fail('Identifier and password are required');
$st=db()->prepare('SELECT u.*, COALESCE(s.session_version,0) AS session_version FROM users u LEFT JOIN user_session_versions s ON s.user_id=u.id WHERE u.email=? OR u.mobile=? OR u.user_id=? LIMIT 1');
$st->execute([strtolower($identifier),$mobileIdentifier,strtolower($identifier)]); $u=$st->fetch();
if(!$u||!password_verify($password,$u['password_hash'])) {
    mfa_log('Login credentials rejected');
    fail('Invalid credentials',401);
}
mfa_log('Login credentials accepted', ['user_id' => (int)$u['id']]);
if($u['account_status']!=='active') fail('Account unavailable',403);
if (mfa_is_enabled()) {
    mfa_log('MFA is enabled for login', ['user_id' => (int)$u['id']]);
    // Require a fresh OTP challenge on every successful login while MFA is enabled.
    // Keep the existing first_login purpose for compatibility with the current
    // web/mobile verification clients and verify_otp.php contract.
    mfa_log('Login OTP verification is required', ['user_id' => (int)$u['id']]);
    try {
        $challenge = create_otp_challenge((int)$u['id'], 'first_login', $u['email'] ?: null, $u['mobile'] ?: null, (string)$u['name']);
    } catch (Throwable $e) {
        error_log('Login OTP could not be sent for user ' . (int)$u['id'] . ': ' . $e->getMessage());
        fail('Unable to send verification code. Please try again later.', 503);
    }
    mfa_log('Login OTP challenge returned to client', ['user_id' => (int)$u['id']]);
    out(['mfa_required'=>true,'challenge_id'=>$challenge,'message'=>'Verification code sent to your registered email and mobile number.']);
}
mfa_log('Login proceeding without an OTP challenge', ['user_id' => (int)$u['id']]);
out(['token'=>token_for((int)$u['id'], (int)$u['session_version']),'user'=>['id'=>(int)$u['id'],'name'=>$u['name'],'user_id'=>$u['user_id'],'email'=>$u['email'],'mobile'=>$u['mobile'],'gender'=>$u['gender']]]);
