<?php
return [
    'db' => [
        'host' => 'YOUR_GODADDY_MYSQL_HOST',
        'name' => 'YOUR_GODADDY_DATABASE_NAME',
        'user' => 'YOUR_GODADDY_DATABASE_USER',
        'pass' => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'base_url' => 'https://www.cloudcomai.com/apiapp/api',
        // Full web URL, including /app if installed there. Used by recovery emails.
        'web_url' => 'https://www.cloudcomai.com',
        // A real sender mailbox accepted by this hosting account's PHP mail transport.
        'mail_from' => 'support@cloudcomai.com',
        // Master switch for registration and first-login OTP. Keep false until delivery is configured.
        'mfa_enabled' => false,
        // OTP policy and provider credentials. Keep real credentials only in config.php on the server.
        'otp' => [
            'ttl_seconds' => 300,
            'max_attempts' => 5,
            'resend_cooldown_seconds' => 60,
            'max_sends_per_hour' => 5,
            'sms' => [
                'provider' => 'textbee',
                'api_url' => 'https://api.textbee.dev/api/v1/gateway/send-sms',
                'api_key' => '',
                'device_id' => '',
            ],
        ],
        'allowed_origins' => [
            'https://www.cloudcomai.com',
            'https://cloudcomai.com',
            'https://app.cloudcomai.com',
        ],
        'token_secret' => 'GENERATE_ONCE_AND_KEEP_THIS_PRODUCTION_SECRET_STABLE',
        // Keep these values outside source control in production. backup_dir must not be web-readable.
        'backup_encryption_key' => 'GENERATE_A_RANDOM_32_BYTE_SECRET_AND_KEEP_IT_PRIVATE',
        'backup_max_bytes' => 25 * 1024 * 1024,
        'backup_dir' => __DIR__ . '/../storage/backups',
        'upload_dir' => __DIR__ . '/../storage/uploads',
        'retention' => [
            // Values are seconds. Missing/invalid values use 30 days for private/group and 4 hours for public chats.
            'private' => 2592000,
            'group' => 2592000,
            'public' => 14400,
        ],
    ],
    'google' => [
        'client_id' => 'YOUR_PRODUCTION_GOOGLE_OAUTH_CLIENT_ID',
        'client_secret' => 'YOUR_PRODUCTION_GOOGLE_OAUTH_CLIENT_SECRET',
        'redirect_uri' => 'https://www.cloudcomai.com/apiapp/api/v1/integrations/google/callback',
    ],
];
