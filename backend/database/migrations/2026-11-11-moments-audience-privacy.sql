CREATE TABLE IF NOT EXISTS story_groups (
    story_id BIGINT UNSIGNED NOT NULL,
    chat_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (story_id, chat_id),
    INDEX idx_story_groups_chat_story (chat_id, story_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_story_hidden_contacts (
    user_id BIGINT UNSIGNED NOT NULL,
    hidden_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, hidden_user_id),
    INDEX idx_story_hidden_contact (hidden_user_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
