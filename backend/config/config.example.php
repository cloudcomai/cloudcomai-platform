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
        'web_url' => 'https://www.cloudcomai.com',
        'mail_from' => 'support@cloudcomai.com',
        'allowed_origins' => [
            'https://www.cloudcomai.com',
            'https://cloudcomai.com',
            'https://app.cloudcomai.com',
        ],
        'token_secret' => 'GENERATE_ONCE_AND_KEEP_THIS_PRODUCTION_SECRET_STABLE',
        // Keep these values outside source control in production. backup_dir must not be web-readable.
        'backup_encryption_key' => 'GENERATE_A_RANDOM_32_BYTE_SECRET_AND_KEEP_IT_PRIVATE',
        'backup_cron_secret' => 'GENERATE_A_RANDOM_CRON_SECRET_AND_KEEP_IT_PRIVATE',
        'backup_dir' => __DIR__ . '/../storage/backups',
        'upload_dir' => __DIR__ . '/../storage/uploads',
        'retention' => [
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
