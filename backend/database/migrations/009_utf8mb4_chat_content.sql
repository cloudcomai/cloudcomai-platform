-- Ensure existing installations can store full Unicode, including 4-byte emoji.
-- MySQL utf8 (utf8mb3) replaces unsupported emoji with '?' before the application reads it back.

ALTER TABLE messages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE notification_history CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE polls CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE poll_options CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
