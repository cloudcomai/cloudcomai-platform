-- CloudComAI Platform - consolidated fresh-install schema
-- Generated for a brand-new website launch.
--
-- IMPORTANT:
-- 1. In phpMyAdmin, select the new empty database before importing this file.
-- 2. Do not import this file into an existing CloudComAI database.
-- 3. This file intentionally does not CREATE or USE a named database so it works
--    with the database name assigned by the hosting provider.

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(30) NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NULL,
    mobile VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    gender ENUM('Male','Female') NOT NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    mobile_verified TINYINT(1) NOT NULL DEFAULT 0,
    account_status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    UNIQUE KEY uq_users_user_id (user_id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_mobile (mobile),
    INDEX idx_users_account_status (account_status),
    INDEX idx_users_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_session_versions (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    session_version BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type ENUM('private','group','public','community') NOT NULL,
    name VARCHAR(160) NULL,
    group_category VARCHAR(80) NULL,
    owner_id BIGINT UNSIGNED NULL,
    retention_seconds INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    INDEX idx_chats_owner_id (owner_id),
    INDEX idx_chats_group_category (group_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fixed public city/town rooms. Public room messages expire after 4 hours by default.
INSERT INTO chats(type,name,group_category,owner_id,retention_seconds,created_at)
SELECT 'public',v.name,'india-city',NULL,14400,UTC_TIMESTAMP()
FROM (
    SELECT 'Ahmedabad' AS name
    UNION ALL SELECT 'Agra'
    UNION ALL SELECT 'Amritsar'
    UNION ALL SELECT 'Bengaluru'
    UNION ALL SELECT 'Bareilly'
    UNION ALL SELECT 'Bhopal'
    UNION ALL SELECT 'Bhubaneswar'
    UNION ALL SELECT 'Chandigarh'
    UNION ALL SELECT 'Chennai'
    UNION ALL SELECT 'Coimbatore'
    UNION ALL SELECT 'Dehradun'
    UNION ALL SELECT 'Delhi'
    UNION ALL SELECT 'Faridabad'
    UNION ALL SELECT 'Ghaziabad'
    UNION ALL SELECT 'Guwahati'
    UNION ALL SELECT 'Gwalior'
    UNION ALL SELECT 'Hubballi'
    UNION ALL SELECT 'Hyderabad'
    UNION ALL SELECT 'Indore'
    UNION ALL SELECT 'Jaipur'
    UNION ALL SELECT 'Jabalpur'
    UNION ALL SELECT 'Jodhpur'
    UNION ALL SELECT 'Kanpur'
    UNION ALL SELECT 'Kochi'
    UNION ALL SELECT 'Kolkata'
    UNION ALL SELECT 'Kota'
    UNION ALL SELECT 'Lucknow'
    UNION ALL SELECT 'Ludhiana'
    UNION ALL SELECT 'Madurai'
    UNION ALL SELECT 'Meerut'
    UNION ALL SELECT 'Mumbai'
    UNION ALL SELECT 'Mysuru'
    UNION ALL SELECT 'Nagpur'
    UNION ALL SELECT 'Nashik'
    UNION ALL SELECT 'Patna'
    UNION ALL SELECT 'Pune'
    UNION ALL SELECT 'Raipur'
    UNION ALL SELECT 'Rajkot'
    UNION ALL SELECT 'Ranchi'
    UNION ALL SELECT 'Salem'
    UNION ALL SELECT 'Srinagar'
    UNION ALL SELECT 'Surat'
    UNION ALL SELECT 'Thiruvananthapuram'
    UNION ALL SELECT 'Tiruchirappalli'
    UNION ALL SELECT 'Tiruppur'
    UNION ALL SELECT 'Vadodara'
    UNION ALL SELECT 'Varanasi'
    UNION ALL SELECT 'Vijayawada'
    UNION ALL SELECT 'Visakhapatnam'
    UNION ALL SELECT 'Warangal'
) v
WHERE NOT EXISTS (
    SELECT 1 FROM chats c
    WHERE c.type='public' AND c.group_category='india-city' AND c.name=v.name
);

CREATE TABLE IF NOT EXISTS chat_members (
    chat_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role ENUM('owner','admin','moderator','member','readonly') NOT NULL DEFAULT 'member',
    status ENUM('active','pending','removed','banned') NOT NULL DEFAULT 'active',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id),
    INDEX idx_chat_members_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(40) NOT NULL DEFAULT 'text',
    body TEXT NULL,
    reply_to_message_id BIGINT UNSIGNED NULL,
    edit_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    edited_at DATETIME NULL,
    deleted_for_everyone TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages_chat_id_id (chat_id, id),
    INDEX idx_messages_sender_id (sender_id),
    INDEX idx_messages_expires_at (expires_at),
    INDEX idx_messages_reply_to (reply_to_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_devices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    platform ENUM('ANDROID','IOS') NOT NULL,
    token VARCHAR(512) NOT NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_notification_device_token (token),
    INDEX idx_notification_devices_user (user_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    category ENUM('message','group','attachment','system') NOT NULL,
    title VARCHAR(160) NOT NULL,
    body VARCHAR(500) NOT NULL,
    data_json JSON NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notification_history_user_cursor (user_id, id),
    INDEX idx_notification_history_user_unread (user_id, read_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_delivery_queue (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    notification_id BIGINT UNSIGNED NOT NULL,
    device_id BIGINT UNSIGNED NOT NULL,
    status ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ticket_id VARCHAR(128) NULL,
    last_error VARCHAR(500) NULL,
    available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_notification_delivery (notification_id, device_id),
    INDEX idx_notification_delivery_pending (status, available_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_user_states (
    message_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    hidden TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_user_states (
    chat_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    hidden TINYINT(1) NOT NULL DEFAULT 0,
    cleared_through_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
    last_read_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
    notifications_muted TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id),
    INDEX idx_chat_user_states_user_hidden (user_id, hidden),
    INDEX idx_chat_user_states_user_muted (user_id, notifications_muted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    hide_online_status TINYINT(1) NOT NULL DEFAULT 0,
    media_auto_download TINYINT(1) NOT NULL DEFAULT 0,
    screenshot_alerts TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_blocks (
    user_id BIGINT UNSIGNED NOT NULL,
    blocked_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, blocked_user_id),
    INDEX idx_user_blocks_blocked_user (blocked_user_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_invites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    requires_approval TINYINT(1) NOT NULL DEFAULT 0,
    max_uses INT UNSIGNED NULL,
    use_count INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_group_invites_token_hash (token_hash),
    INDEX idx_group_invites_chat_id (chat_id),
    INDEX idx_group_invites_active_expiry (active, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_shortcuts (
    user_id BIGINT UNSIGNED NOT NULL,
    chat_id BIGINT UNSIGNED NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_interests (
    user_id BIGINT UNSIGNED NOT NULL,
    interest VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    pinned TINYINT(1) NOT NULL DEFAULT 1,
    hidden TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, interest)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS polls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    creator_id BIGINT UNSIGNED NOT NULL,
    question VARCHAR(500) NOT NULL,
    multiple_choice TINYINT(1) NOT NULL DEFAULT 0,
    anonymous TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closes_at DATETIME NULL,
    closed_at DATETIME NULL,
    INDEX idx_polls_chat_id (chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_options (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    poll_id BIGINT UNSIGNED NOT NULL,
    option_text VARCHAR(300) NOT NULL,
    display_order INT NOT NULL,
    INDEX idx_poll_options_poll_id (poll_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id BIGINT UNSIGNED NOT NULL,
    option_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (poll_id, option_id, user_id),
    INDEX idx_poll_votes_user (poll_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    audience VARCHAR(40) NOT NULL DEFAULT 'friends',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    deleted_at DATETIME NULL,
    INDEX idx_stories_user_id (user_id),
    INDEX idx_stories_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS live_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_update_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    stopped_at DATETIME NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    INDEX idx_live_locations_chat_active (chat_id, active),
    INDEX idx_live_locations_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    caller_id BIGINT UNSIGNED NOT NULL,
    recipient_id BIGINT UNSIGNED NOT NULL,
    type ENUM('audio','video') NOT NULL,
    status VARCHAR(30) NOT NULL,
    session_token_hash CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    INDEX idx_calls_caller_id (caller_id),
    INDEX idx_calls_recipient_id (recipient_id),
    INDEX idx_calls_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME NULL,
    UNIQUE KEY uq_password_reset_token_hash (token_hash),
    INDEX idx_password_reset_user_id (user_id),
    INDEX idx_password_reset_expires_at (expires_at),
    INDEX idx_password_reset_user_used (user_id, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_attachments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT UNSIGNED NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    download_policy ENUM('ALLOW','APPROVAL_REQUIRED','VIEW_ONLY') NOT NULL DEFAULT 'APPROVAL_REQUIRED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_message_attachments_stored_filename (stored_filename),
    INDEX idx_message_attachments_message_id (message_id),
    INDEX idx_message_attachments_download_policy (download_policy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attachment_download_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    attachment_id BIGINT UNSIGNED NOT NULL,
    requester_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    status ENUM('PENDING','APPROVED','DENIED') NOT NULL DEFAULT 'PENDING',
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    UNIQUE KEY uq_attachment_request (attachment_id, requester_id),
    INDEX idx_attachment_requests_sender_status (sender_id, status),
    INDEX idx_attachment_requests_requester_status (requester_id, status),
    INDEX idx_attachment_requests_attachment_status (attachment_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS google_oauth_states (
    state VARCHAR(128) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_google_oauth_states_expiry (expires_at),
    INDEX idx_google_oauth_states_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS google_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    google_subject VARCHAR(255) NULL,
    google_email VARCHAR(320) NULL,
    refresh_token_encrypted TEXT NOT NULL,
    scope TEXT NULL,
    contacts_sync_token TEXT NULL,
    last_contacts_sync_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_accounts_user (user_id),
    UNIQUE KEY uq_google_accounts_subject (google_subject),
    INDEX idx_google_accounts_email (google_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS google_contacts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    google_account_id BIGINT UNSIGNED NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NULL,
    given_name VARCHAR(255) NULL,
    family_name VARCHAR(255) NULL,
    email VARCHAR(320) NULL,
    phone VARCHAR(100) NULL,
    photo_url TEXT NULL,
    google_etag VARCHAR(255) NULL,
    deleted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_contacts_resource (google_account_id, resource_name),
    INDEX idx_google_contacts_user (user_id),
    INDEX idx_google_contacts_email (user_id, email),
    CONSTRAINT fk_google_contacts_account
        FOREIGN KEY (google_account_id) REFERENCES google_accounts (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) NOT NULL PRIMARY KEY,
    executed_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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


INSERT INTO schema_migrations (version, executed_at)
VALUES
    ('003_chat_attachments.sql', UTC_TIMESTAMP()),
    ('004_google_contacts_sync.sql', UTC_TIMESTAMP()),
    ('005_chat_user_states.sql', UTC_TIMESTAMP()),
    ('006_privacy_and_security.sql', UTC_TIMESTAMP()),
    ('007_password_recovery_sessions.sql', UTC_TIMESTAMP()),
    ('008_chat_notification_states.sql', UTC_TIMESTAMP()),
    ('009_utf8mb4_chat_content.sql', UTC_TIMESTAMP()),
    ('010_ensure_emoji_utf8mb4.sql', UTC_TIMESTAMP()),
    ('012_chat_lifecycle_controls.sql', UTC_TIMESTAMP()),
    ('013_public_city_chat_rooms.sql', UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE executed_at = executed_at;

SET FOREIGN_KEY_CHECKS = 1;
