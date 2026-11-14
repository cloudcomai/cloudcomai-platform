<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/mfa.php';

function expect_mfa(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$GLOBALS['config'] = ['app' => ['mfa_enabled' => false, 'token_secret' => str_repeat('t', 32), 'otp' => ['ttl_seconds' => 300]]];
expect_mfa(mfa_is_enabled() === false, 'MFA must default to disabled');
$GLOBALS['config']['app']['mfa_enabled'] = true;
expect_mfa(mfa_is_enabled() === true, 'Boolean true must enable MFA');
$GLOBALS['config']['app']['mfa_enabled'] = 'true';
expect_mfa(mfa_is_enabled() === true, 'String true must enable MFA');
$GLOBALS['config']['app']['mfa_enabled'] = 'false';
expect_mfa(mfa_is_enabled() === false, 'String false must disable MFA');
expect_mfa(otp_config('ttl_seconds', 300) === 300, 'OTP settings must be read from app configuration');
unset($GLOBALS['config']['app']['token_secret']);
$otpHash = otp_hash_code('123456');
expect_mfa(otp_code_matches('123456', $otpHash), 'Correct OTP must match its password hash');
expect_mfa(!otp_code_matches('654321', $otpHash), 'Incorrect OTP must not match its password hash');
expect_mfa(strlen($otpHash) === 60, 'OTP hashes must fit the existing CHAR(64) database column');
echo "MFA configuration tests passed\n";
