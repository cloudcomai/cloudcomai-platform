-- Persist device phone contacts for unified contact matching.
CREATE TABLE IF NOT EXISTS phone_contacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  contact_key VARCHAR(320) NOT NULL,
  display_name VARCHAR(255) NULL,
  email VARCHAR(320) NULL,
  phone VARCHAR(100) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_phone_contacts_user_key(user_id,contact_key),
  INDEX(user_id),
  INDEX(user_id,email),
  INDEX(user_id,phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Presence is derived from users.updated_at; no random or hard-coded state is stored:
-- <=90s ONLINE, >90s and <=300s AWAY, >300s OFFLINE.
