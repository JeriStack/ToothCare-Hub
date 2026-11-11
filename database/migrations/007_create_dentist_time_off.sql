-- Migration 007: Create dentist_time_off table
-- Records approved practitioner leaves, vacations, and emergency blocked clinic hours.

CREATE TABLE IF NOT EXISTS dentist_time_off (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dentist_id BIGINT UNSIGNED NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    reason VARCHAR(255) NOT NULL,
    approved_by_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_time_off_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_time_off_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_time_off_interval CHECK (start_at < end_at),
    INDEX idx_time_off_dentist_interval (dentist_id, start_at, end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
