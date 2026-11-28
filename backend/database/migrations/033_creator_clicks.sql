-- Creator Clicks isolated schema.
-- Apply once during deployment. Roll back by dropping these tables in reverse dependency order.
-- This migration does not alter chat, message, Moments, or notification tables.

CREATE TABLE IF NOT EXISTS creator_clicks_profiles (
    user_id BIGINT UNSIGNED NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    bio VARCHAR(300) NOT NULL DEFAULT '',
    category VARCHAR(60) NOT NULL DEFAULT 'Creator',
    platform_verified_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    KEY idx_creator_clicks_profiles_name (display_name),
    CONSTRAINT chk_creator_clicks_profile_name CHECK (CHAR_LENGTH(TRIM(display_name)) BETWEEN 1 AND 80),
    CONSTRAINT chk_creator_clicks_profile_bio CHECK (CHAR_LENGTH(bio) <= 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_clicks_follows (
    follower_id BIGINT UNSIGNED NOT NULL,
    creator_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, creator_id),
    KEY idx_creator_clicks_follow_creator (creator_id, created_at),
    CONSTRAINT chk_creator_clicks_no_self_follow CHECK (follower_id <> creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_clicks_posts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    creator_id BIGINT UNSIGNED NOT NULL,
    content_type ENUM('text','image','video','voice','poll') NOT NULL,
    body TEXT NOT NULL,
    media_manifest JSON NULL,
    poll_manifest JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_creator_clicks_posts_feed (creator_id, created_at, id),
    KEY idx_creator_clicks_posts_expiry (expires_at, deleted_at),
    CONSTRAINT chk_creator_clicks_post_body CHECK (CHAR_LENGTH(body) <= 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_clicks_reactions (
    post_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    reaction VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    KEY idx_creator_clicks_reactions_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_clicks_post_views (
    post_id BIGINT UNSIGNED NOT NULL,
    viewer_id BIGINT UNSIGNED NOT NULL,
    viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, viewer_id),
    KEY idx_creator_clicks_views_viewer (viewer_id, viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_clicks_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id BIGINT UNSIGNED NOT NULL,
    reporter_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(80) NOT NULL,
    details VARCHAR(500) NOT NULL DEFAULT '',
    status ENUM('pending','reviewed','dismissed','actioned') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_creator_clicks_reporter_post (post_id, reporter_id),
    KEY idx_creator_clicks_reports_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_clicks_blocks (
    blocker_id BIGINT UNSIGNED NOT NULL,
    blocked_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id),
    KEY idx_creator_clicks_blocked (blocked_id, blocker_id),
    CONSTRAINT chk_creator_clicks_no_self_block CHECK (blocker_id <> blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
