CREATE TABLE IF NOT EXISTS account_backup_settings (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    backup_account_email VARCHAR(190) NOT NULL,
    automatic_frequency ENUM('off','daily','weekly','monthly') NOT NULL DEFAULT 'off',
    include_videos TINYINT(1) NOT NULL DEFAULT 0,
    wifi_only TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account_backup_settings_email (backup_account_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_backups (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    version INT UNSIGNED NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    backup_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
    last_backup_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account_backups_last_backup (last_backup_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_backup_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    backup_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_account_backup_version (user_id, version),
    INDEX idx_account_backup_versions_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
