-- CloudComAI: guarantee full Unicode / 4-byte emoji support for existing installations.
-- MySQL utf8mb3 cannot store many emoji and may turn them into '?'.
-- This migration is safe to run after 009_utf8mb4_chat_content.sql.

ALTER TABLE messages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE notification_history CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE polls CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE poll_options CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Explicitly protect the message body column used by the chat composer.
ALTER TABLE messages MODIFY body TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
