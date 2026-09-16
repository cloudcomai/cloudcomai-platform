-- Android message notification preferences for existing installations.
ALTER TABLE user_notification_preferences
    ADD COLUMN sound TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN vibration TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN preview TINYINT(1) NOT NULL DEFAULT 1;
