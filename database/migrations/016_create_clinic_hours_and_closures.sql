-- Migration 016: Create clinic_operating_hours and clinic_closures tables
-- Manages facility-level operating hours, shift intervals, holiday closures, and maintenance periods.

CREATE TABLE IF NOT EXISTS clinic_operating_hours (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    day_of_week TINYINT UNSIGNED NOT NULL COMMENT '1=Monday, 2=Tuesday, ..., 7=Sunday',
    opening_time TIME NOT NULL DEFAULT '08:00:00',
    closing_time TIME NOT NULL DEFAULT '17:00:00',
    is_closed TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_clinic_hours_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_clinic_hours_interval CHECK (is_closed = 1 OR opening_time < closing_time),
    INDEX idx_clinic_hours_day (day_of_week, is_closed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clinic_closures (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    closure_type ENUM('HOLIDAY', 'MAINTENANCE', 'EMERGENCY', 'SPECIAL_CLOSURE') NOT NULL DEFAULT 'HOLIDAY',
    notes TEXT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_closures_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_closures_interval CHECK (start_at < end_at),
    INDEX idx_closures_interval (start_at, end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default clinic operating schedule (Monday to Friday 08:00-17:00, Saturday 08:00-12:00, Sunday closed)
INSERT INTO clinic_operating_hours (day_of_week, opening_time, closing_time, is_closed) VALUES
(1, '08:00:00', '17:00:00', 0),
(2, '08:00:00', '17:00:00', 0),
(3, '08:00:00', '17:00:00', 0),
(4, '08:00:00', '17:00:00', 0),
(5, '08:00:00', '17:00:00', 0),
(6, '08:00:00', '12:00:00', 0),
(7, '08:00:00', '17:00:00', 1);

