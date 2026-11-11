-- Migration 006: Create dentist_schedules table
-- Stores recurring weekly practitioner working shifts and operatory chair allocations.

CREATE TABLE IF NOT EXISTS dentist_schedules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dentist_id BIGINT UNSIGNED NOT NULL,
    day_of_week TINYINT UNSIGNED NOT NULL COMMENT '1=Monday, 2=Tuesday, ..., 7=Sunday',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    operatory_chair VARCHAR(50) NOT NULL DEFAULT 'Chair 1',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dentist_schedules_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_dentist_schedules_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_dentist_schedules_time CHECK (start_time < end_time),
    INDEX idx_schedules_dentist_day (dentist_id, day_of_week, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
