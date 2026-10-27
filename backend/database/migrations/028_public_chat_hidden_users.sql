-- Per-user hide list for public-chat participants who have been reported.
-- Reporting automatically hides the reported account from that reporter in every public chat.
CREATE TABLE IF NOT EXISTS public_chat_hidden_users (
    user_id BIGINT UNSIGNED NOT NULL,
    hidden_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id,hidden_user_id),
    INDEX idx_public_chat_hidden_target (hidden_user_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
