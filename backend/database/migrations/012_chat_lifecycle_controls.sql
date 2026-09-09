CREATE TABLE IF NOT EXISTS message_deletions (
    message_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_message_deletions_chat (chat_id, message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS file_cleanup_queue (
    storage_path VARCHAR(512) NOT NULL PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_error VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    message TINYINT(1) NOT NULL DEFAULT 1,
    `group` TINYINT(1) NOT NULL DEFAULT 1,
    attachment TINYINT(1) NOT NULL DEFAULT 1,
    `system` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_visibility (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    share_email TINYINT(1) NOT NULL DEFAULT 0,
    share_mobile TINYINT(1) NOT NULL DEFAULT 0,
    share_age TINYINT(1) NOT NULL DEFAULT 1,
    share_gender TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NOT NULL,
    saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_saved_message (user_id, message_id),
    INDEX idx_saved_messages_cursor (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_role_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    previous_owner_id BIGINT UNSIGNED NOT NULL,
    new_owner_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_group_role_events_chat (chat_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_send_requests (
    user_id BIGINT UNSIGNED NOT NULL,
    client_id VARCHAR(96) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    message_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, client_id),
    UNIQUE KEY uq_message_send_request_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
    id CHAR(32) NOT NULL PRIMARY KEY,
    token_hash CHAR(64) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    device_label VARCHAR(160) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    UNIQUE KEY uq_user_sessions_token (token_hash),
    INDEX idx_user_sessions_active (user_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_session_devices (
    device_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    session_id CHAR(32) NOT NULL,
    INDEX idx_session_devices_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve any earlier retention deadline on existing poll messages.
UPDATE polls SET closes_at=DATE_ADD(created_at, INTERVAL 30 DAY) WHERE closes_at IS NULL;
UPDATE messages m INNER JOIN polls p ON p.chat_id=m.chat_id
    AND p.id=CAST(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(m.body) THEN m.body ELSE '{}' END,'$.poll_id')) AS UNSIGNED)
SET m.expires_at=LEAST(COALESCE(m.expires_at,p.closes_at),p.closes_at)
WHERE m.type='poll' AND m.deleted_for_everyone=0;
