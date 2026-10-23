-- CloudComAI @Mentions foundation for eligible group/public-chat recipients.
-- Migration 026 is used by the open group attachment-access PR, so this feature
-- deliberately uses 027 to avoid colliding with that unmerged branch.
CREATE TABLE IF NOT EXISTS message_mentions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT UNSIGNED NOT NULL,
    chat_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    recipient_id BIGINT UNSIGNED NOT NULL,
    chat_type ENUM('group','public') NOT NULL,
    notification_id BIGINT UNSIGNED NULL,
    read_at DATETIME NULL,
    removed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_message_mentions_recipient_active (recipient_id, removed_at, id),
    INDEX idx_message_mentions_recipient_unread (recipient_id, removed_at, read_at, id),
    INDEX idx_message_mentions_message_active (message_id, removed_at, recipient_id),
    INDEX idx_message_mentions_chat_message (chat_id, message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

