ALTER TABLE chat_user_states
    ADD COLUMN last_read_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER cleared_through_message_id,
    ADD COLUMN notifications_muted TINYINT(1) NOT NULL DEFAULT 0 AFTER last_read_message_id;

CREATE INDEX idx_chat_user_states_user_muted
    ON chat_user_states (user_id, notifications_muted);
