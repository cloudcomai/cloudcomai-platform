ALTER TABLE chat_user_states
    ADD COLUMN notifications_muted_until DATETIME NULL AFTER notifications_muted;

CREATE INDEX idx_chat_user_states_mute_until
    ON chat_user_states (user_id, notifications_muted, notifications_muted_until);

UPDATE chat_user_states
SET notifications_muted_until = NULL
WHERE notifications_muted = 1;
