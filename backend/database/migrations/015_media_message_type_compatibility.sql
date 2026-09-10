-- Ensure existing/legacy databases can store all current message types.
-- Fresh installs already use VARCHAR(40); this migration safely aligns older schemas.
ALTER TABLE messages
    MODIFY COLUMN type VARCHAR(40) NOT NULL DEFAULT 'text';
