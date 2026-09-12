CREATE TABLE IF NOT EXISTS account_backup_settings (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  backup_account_email VARCHAR(190) NOT NULL,
  automatic_frequency ENUM('off','daily','weekly','monthly') NOT NULL DEFAULT 'off',
  include_videos TINYINT(1) NOT NULL DEFAULT 0,
  wifi_only TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL,
  INDEX(backup_account_email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_backups (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  version INT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  backup_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_backup_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX(last_backup_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_backup_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  backup_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_account_backup_version(user_id,version),
  INDEX(user_id,created_at)
) ENGINE=InnoDB;
