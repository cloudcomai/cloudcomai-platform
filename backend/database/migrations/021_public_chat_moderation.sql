-- Public-chat moderation: per-room reports and 7-day restrictions.
CREATE TABLE IF NOT EXISTS public_chat_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    reporter_id BIGINT UNSIGNED NOT NULL,
    reported_user_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NULL,
    incident_key VARCHAR(128) NOT NULL,
    reason VARCHAR(80) NOT NULL,
    details VARCHAR(2000) NULL,
    status ENUM('valid','invalid','reviewed') NOT NULL DEFAULT 'valid',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    UNIQUE KEY uq_public_chat_report_incident (chat_id,reporter_id,reported_user_id,incident_key),
    INDEX idx_public_chat_reports_target (chat_id,reported_user_id,status,created_at),
    INDEX idx_public_chat_reports_message (chat_id,message_id),
    INDEX idx_public_chat_reports_reporter (reporter_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS public_chat_restrictions (
    chat_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    blocked_at DATETIME NULL,
    blocked_until DATETIME NULL,
    reason VARCHAR(160) NULL,
    status ENUM('active','expired','removed','extended') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id,user_id),
    INDEX idx_public_chat_restrictions_active (user_id,status,blocked_until),
    INDEX idx_public_chat_restrictions_chat (chat_id,status,blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
