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
expect_mfa(otp_signing_secret() === str_repeat('t', 32), 'OTP signing must reuse the existing application token secret');
$GLOBALS['config']['app']['otp']['signing_secret'] = str_repeat('o', 48);
expect_mfa(otp_signing_secret() === str_repeat('t', 32), 'OTP signing must ignore any separate OTP signing key');
$GLOBALS['config']['app']['token_secret'] = 'short';
try {
    otp_signing_secret();
    throw new RuntimeException('Short application token secrets must be rejected');
} catch (RuntimeException $e) {
    expect_mfa(str_contains($e->getMessage(), 'app.token_secret'), 'Missing-secret errors must identify the existing configuration path');
}
echo "MFA configuration tests passed\n";
