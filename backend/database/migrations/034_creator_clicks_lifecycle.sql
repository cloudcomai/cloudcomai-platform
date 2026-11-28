-- Creator Clicks lifecycle, channel identity, and cleanup queue.
-- Isolated from CloudComAI account, chat, and Moments data.

ALTER TABLE creator_clicks_profiles
    ADD COLUMN channel_name VARCHAR(100) NOT NULL DEFAULT '' AFTER display_name,
    ADD COLUMN avatar_path VARCHAR(255) NULL AFTER category,
    ADD COLUMN channel_avatar_path VARCHAR(255) NULL AFTER avatar_path,
    ADD COLUMN channel_deleted_at DATETIME NULL AFTER updated_at,
    ADD KEY idx_creator_clicks_channel_active (channel_deleted_at, updated_at);

UPDATE creator_clicks_profiles
SET channel_name = display_name
WHERE channel_name = '';

ALTER TABLE creator_clicks_posts
    ADD COLUMN feed_expires_at DATETIME NULL AFTER created_at,
    ADD KEY idx_creator_clicks_feed_expiry (feed_expires_at, deleted_at);

UPDATE creator_clicks_posts
SET feed_expires_at = LEAST(DATE_ADD(created_at, INTERVAL 24 HOUR), expires_at)
WHERE feed_expires_at IS NULL;

ALTER TABLE creator_clicks_posts
    MODIFY feed_expires_at DATETIME NOT NULL;

CREATE TABLE IF NOT EXISTS creator_clicks_media_cleanup (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    creator_id BIGINT UNSIGNED NOT NULL,
    filename VARCHAR(255) NOT NULL,
    status ENUM('pending','processing','deleted','failed') NOT NULL DEFAULT 'pending',
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    last_error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_creator_clicks_media_cleanup (creator_id, filename),
    KEY idx_creator_clicks_media_cleanup_pending (status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill is idempotent. A post's 90-day expiry remains independent from its
-- 24-hour feed visibility deadline.
