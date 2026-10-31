CREATE TABLE IF NOT EXISTS user_chat_preferences (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    font_color VARCHAR(20) NOT NULL DEFAULT 'default',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_chat_preferences_font_color (font_color)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
