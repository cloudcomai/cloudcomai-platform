-- Add text-message forwarding metadata without changing existing message behavior.
ALTER TABLE messages
    ADD COLUMN forwarded_from_message_id BIGINT UNSIGNED NULL AFTER reply_to_message_id,
    ADD INDEX idx_messages_forwarded_from (forwarded_from_message_id);
