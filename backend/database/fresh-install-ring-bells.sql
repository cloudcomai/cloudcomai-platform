-- Ring Bells fresh-install schema companion.
-- Kept idempotent so fresh installs can apply this immediately after fresh-install.sql.
ALTER TABLE stories MODIFY COLUMN content LONGTEXT NOT NULL;
CREATE TABLE IF NOT EXISTS story_views (
  story_id BIGINT UNSIGNED NOT NULL,
  viewer_id BIGINT UNSIGNED NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (story_id, viewer_id),
  INDEX idx_story_views_viewer_story (viewer_id, story_id),
  INDEX idx_story_views_story_viewed_at (story_id, viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
