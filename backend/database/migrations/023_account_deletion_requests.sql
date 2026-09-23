CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','processing','completed','cancelled','rejected') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  notes VARCHAR(500) NULL,
  INDEX idx_account_deletion_user_status (user_id,status),
  INDEX idx_account_deletion_status_requested (status,requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
