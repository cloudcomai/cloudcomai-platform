-- Only password resets increment this version; existing sessions start at zero.
CREATE TABLE IF NOT EXISTS user_session_versions (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    session_version BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
