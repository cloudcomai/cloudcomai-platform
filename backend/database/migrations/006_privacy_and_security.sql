CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    hide_online_status TINYINT(1) NOT NULL DEFAULT 0,
    media_auto_download TINYINT(1) NOT NULL DEFAULT 0,
    screenshot_alerts TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_blocks (
    user_id BIGINT UNSIGNED NOT NULL,
    blocked_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, blocked_user_id),
    INDEX idx_user_blocks_blocked_user (blocked_user_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
