-- User-to-user contact requests require explicit recipient approval.
CREATE TABLE IF NOT EXISTS friend_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    requester_id BIGINT UNSIGNED NOT NULL,
    recipient_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending','accepted','declined','blocked','cancelled') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    INDEX idx_friend_requests_recipient_status (recipient_id, status, id),
    INDEX idx_friend_requests_requester_status (requester_id, status, id),
    INDEX idx_friend_requests_pair (requester_id, recipient_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
