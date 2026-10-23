-- Add owner-controlled group attachment download/forward permissions.
-- Additive migration for existing installations.
CREATE TABLE IF NOT EXISTS group_attachment_access (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    grant_scope ENUM('member','group') NOT NULL,
    member_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 means group-wide grant',
    download_enabled TINYINT(1) NOT NULL DEFAULT 0,
    forward_enabled TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_group_attachment_access_scope_member (chat_id,grant_scope,member_id),
    INDEX idx_group_attachment_access_expiry (chat_id,expires_at,revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
