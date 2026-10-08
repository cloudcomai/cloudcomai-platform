-- Optimize Home chat list lookups.
-- Safe for existing databases and fresh installs.

ALTER TABLE messages
    ADD INDEX idx_messages_chat_created_id (chat_id, created_at, id);

ALTER TABLE chat_members
    ADD INDEX idx_chat_members_user_status_chat (user_id, status, chat_id);
