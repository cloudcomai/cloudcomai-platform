CREATE TABLE IF NOT EXISTS trusted_users (
    owner_user_id BIGINT UNSIGNED NOT NULL,
    trusted_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_user_id, trusted_user_id),
    INDEX idx_trusted_users_trusted_user (trusted_user_id, owner_user_id),
    CONSTRAINT chk_trusted_users_not_self CHECK (owner_user_id <> trusted_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
