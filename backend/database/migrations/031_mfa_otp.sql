-- CloudComAI MFA / OTP challenge storage.
-- Safe for environments that already ran fresh-install.sql.
CREATE TABLE IF NOT EXISTS otp_challenges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    challenge_hash CHAR(64) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    purpose ENUM('registration','first_login','mobile_change') NOT NULL,
    destination_email VARCHAR(190) NULL,
    destination_mobile VARCHAR(30) NULL,
    otp_hash CHAR(64) NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_challenges_user_purpose (user_id, purpose, created_at),
    INDEX idx_otp_challenges_expiry (expires_at),
    UNIQUE KEY uq_otp_challenges_hash (challenge_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_mfa_state (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    first_login_verified_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
