<?php
declare(strict_types=1);

/**
 * CloudComAI application logging configuration.
 *
 * CLOUDCOMAI_LOG_DIR can be set to an absolute server path when the
 * deployment layout differs from the repository layout.
 * CLOUDCOMAI_LOG_FILE can be used to change the active filename.
 */
return [
    'directory' => getenv('CLOUDCOMAI_LOG_DIR') ?: dirname(__DIR__) . '/storage/logs',
    'filename' => getenv('CLOUDCOMAI_LOG_FILE') ?: 'cloudcomai.log',
    'hourly_backup' => true,
    'backup_suffix_format' => 'Ymd_H',
    'retention_hours' => (int)(getenv('CLOUDCOMAI_LOG_RETENTION_HOURS') ?: 168),
];
