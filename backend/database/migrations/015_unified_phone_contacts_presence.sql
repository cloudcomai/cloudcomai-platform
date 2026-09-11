-- Persist mobile phone-contact synchronization and use one real presence model.
CREATE TABLE IF NOT EXISTS phone_contacts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    contact_key VARCHAR(320) NOT NULL,
    display_name VARCHAR(255) NULL,
    email VARCHAR(320) NULL,
    phone VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_phone_contacts_user_key (user_id, contact_key),
    INDEX idx_phone_contacts_user (user_id),
    INDEX idx_phone_contacts_email (user_id, email),
    INDEX idx_phone_contacts_phone (user_id, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Presence is derived from users.updated_at:
-- <=90s = ONLINE, >90s and <=300s = AWAY, >300s = OFFLINE.
-- No synthetic/random status values are stored.
