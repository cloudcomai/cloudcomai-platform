-- Persistent trusted-device records for MFA login.
-- A device stays trusted across app/browser restarts and is untrusted on explicit logout.
CREATE TABLE IF NOT EXISTS trusted_login_devices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    device_label VARCHAR(160) NOT NULL DEFAULT 'Remembered device',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    UNIQUE KEY uq_trusted_login_devices_token (token_hash),
    INDEX idx_trusted_login_devices_user (user_id, revoked_at, last_used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
