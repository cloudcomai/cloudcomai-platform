-- Add the notification delivery queue for existing installations.
-- Fresh installs already include this table in fresh-install.sql.
CREATE TABLE IF NOT EXISTS notification_delivery_queue (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    notification_id BIGINT UNSIGNED NOT NULL,
    device_id BIGINT UNSIGNED NOT NULL,
    status ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ticket_id VARCHAR(128) NULL,
    last_error VARCHAR(500) NULL,
    available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_notification_delivery (notification_id, device_id),
    INDEX idx_notification_delivery_pending (status, available_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
