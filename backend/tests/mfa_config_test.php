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
expect_mfa(otp_signing_secret() === str_repeat('t', 32), 'OTP signing must fall back to the stable application token secret');
$GLOBALS['config']['app']['otp']['signing_secret'] = str_repeat('o', 48);
expect_mfa(otp_signing_secret() === str_repeat('o', 48), 'A dedicated OTP signing secret must take precedence');
$GLOBALS['config']['app']['otp']['signing_secret'] = 'short';
try {
    otp_signing_secret();
    throw new RuntimeException('Short OTP signing secrets must be rejected');
} catch (RuntimeException $e) {
    expect_mfa(str_contains($e->getMessage(), 'app.otp.signing_secret'), 'Missing-secret errors must identify the required configuration path');
}
echo "MFA configuration tests passed\n";
