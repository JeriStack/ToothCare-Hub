-- Migration 022: Create clinic_settings and outbox tables
-- Completes system configuration parameter store and generic transactional event outbox.

CREATE TABLE IF NOT EXISTS clinic_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    description VARCHAR(255) NULL,
    value_type ENUM('string', 'integer', 'boolean', 'json') NOT NULL DEFAULT 'string',
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_clinic_settings_key UNIQUE (setting_key),
    INDEX idx_clinic_settings_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outbox (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    retry_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_outbox_status_time (status, created_at),
    INDEX idx_outbox_aggregate (aggregate_type, aggregate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default clinic settings
INSERT INTO clinic_settings (setting_key, setting_value, description, value_type, is_public) VALUES
('clinic_name', 'ToothCare Hub', 'Official clinic display name', 'string', 1),
('clinic_tagline', 'Healthier Smiles, Brighter Futures.', 'Marketing tagline for patient portal', 'string', 1),
('clinic_phone', '+63 912 345 6789', 'Primary clinic telephone number', 'string', 1),
('clinic_email', 'contact@toothcarehub.example.com', 'Primary clinic email address', 'string', 1),
('clinic_address', '123 Dental Wellness Plaza, Manila, Philippines', 'Clinic physical address', 'string', 1),
('clinic_timezone', 'Asia/Manila', 'Standard clinic operational timezone', 'string', 1),
('booking_advance_days_max', '60', 'Maximum days in advance a patient can book appointments', 'integer', 1),
('cancellation_cutoff_hours', '24', 'Hours prior to appointment when patient cancellations are permitted', 'integer', 1),
('slot_duration_default_minutes', '30', 'Standard appointment slot length in minutes', 'integer', 0),
('compliance_lock_hours', '24', 'Hours post-completion before clinical documentation locks for editing', 'integer', 0)
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
