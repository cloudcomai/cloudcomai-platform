<?php
declare(strict_types=1);

return [
    'directory' => getenv('CLOUDCOMAI_LOG_DIR') ?: dirname(__DIR__) . '/storage/logs',
    'filename' => getenv('CLOUDCOMAI_LOG_FILE') ?: 'cloudcomai.log',
    'hourly_backup' => true,
    'backup_suffix_format' => 'Ymd_H',
    'retention_hours' => (int)(getenv('CLOUDCOMAI_LOG_RETENTION_HOURS') ?: 168),
];
