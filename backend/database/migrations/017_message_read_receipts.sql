CREATE TABLE IF NOT EXISTS message_read_receipts (
    message_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id),
    INDEX idx_message_read_receipts_user_message (user_id, message_id),
    INDEX idx_message_read_receipts_message_read_at (message_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
