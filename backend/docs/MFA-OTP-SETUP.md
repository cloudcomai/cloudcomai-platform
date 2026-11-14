# CloudComAI MFA and OTP configuration

## Master switch

MFA is controlled by one server-side setting in `backend/config/config.php`:

```php
'app' => [
    // ...
    'mfa_enabled' => true,
],
```

- Set `true` to require OTP verification during registration and the first successful sign-in.
- Set `false` to bypass registration/login MFA and preserve the existing authentication flow.
- The setting is read by the PHP API at request time. No frontend build or code deployment is required; a PHP-FPM/OPcache restart may be needed if the host caches PHP files.
- Changing this switch does not disable OTP verification for a user's mobile-number change.

The repository's `config.example.php` defaults the switch to `false`. Enable it only after email and SMS delivery are configured and tested.

## OTP policy

The optional `app.otp` settings control expiry, failed attempts, resend cooldown, and send-rate limits. Defaults are 5 minutes, 5 attempts, 60 seconds, and 5 sends per hour. OTPs are generated with a cryptographically secure random generator, stored as HMAC hashes, expire, and can be consumed once.

When both email and mobile are registered, the same one-time code is sent to both destinations. A challenge is not issued if a required delivery channel fails. OTP values and provider credentials are never returned by the API.

## TextBee SMS provider

Set the following values in the server-only `backend/config/config.php`; never put real credentials in Git, mobile app configuration, or public environment variables:

```php
'otp' => [
    'sms' => [
        'provider' => 'textbee',
        'api_url' => 'https://api.textbee.dev/api/v1/gateway/send-sms',
        'api_key' => 'YOUR_PRIVATE_TEXTBEE_API_KEY',
        'device_id' => 'YOUR_REGISTERED_TEXTBEE_DEVICE_ID',
    ],
],
```

TextBee accepts the send request into its queue; HTTP success does not guarantee carrier delivery. The Android phone must remain online, have SMS permission, and be allowed to run in the background. Keep a fallback plan for SMS outages.

TextBee supports local phone-number format when the recipient is in the same country as the sending SIM; use international format for other countries. Confirm the correct number format for the SIM and destinations before enabling MFA.

For production use in India, confirm applicable operator, DLT, TRAI, and commercial messaging requirements. A personal SIM may not be suitable for ongoing transactional OTP traffic.

Email delivery uses the existing PHP `mail()` transport and `app.mail_from`. Confirm the sender domain and hosting mail transport before enabling MFA.

## Database deployment

For a new database, `backend/database/fresh-install.sql` includes the OTP tables.

For an existing database, run `backend/database/migrations/031_mfa_otp.sql` once before deploying the new PHP code. The migration is additive and uses `CREATE TABLE IF NOT EXISTS`.

## API flow

- Registration with MFA enabled creates the account and returns `mfa_required` plus an opaque `challenge_id`; no bearer token is returned until verification.
- First login with MFA enabled returns the same challenge response until initial verification is complete.
- `POST v1/auth/verify-otp` verifies registration or first-login challenges and then returns the normal session token and user.
- Mobile changes use authenticated `POST v1/users/mobile-verification` with `action=request`, followed by `action=verify`. The number is updated only after OTP verification, regardless of the master MFA switch.
