<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/mfa.php';

function expect_mfa(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

$GLOBALS['config'] = ['app' => ['mfa_enabled' => false, 'otp' => ['ttl_seconds' => 300]]];
expect_mfa(mfa_is_enabled() === false, 'MFA must default to disabled');
$GLOBALS['config']['app']['mfa_enabled'] = true;
expect_mfa(mfa_is_enabled() === true, 'Boolean true must enable MFA');
$GLOBALS['config']['app']['mfa_enabled'] = 'true';
expect_mfa(mfa_is_enabled() === true, 'String true must enable MFA');
$GLOBALS['config']['app']['mfa_enabled'] = 'false';
expect_mfa(mfa_is_enabled() === false, 'String false must disable MFA');
expect_mfa(otp_config('ttl_seconds', 300) === 300, 'OTP settings must be read from app configuration');
echo "MFA configuration tests passed\n";
