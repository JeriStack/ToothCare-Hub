-- Migration 019: Create dentist_services and dentist_schedule_exceptions tables
-- Establishes m:n relationship between clinicians and dental services, and allows date-specific schedule overrides.

CREATE TABLE IF NOT EXISTS dentist_services (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dentist_id BIGINT UNSIGNED NOT NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    custom_duration_minutes SMALLINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dentist_services_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dentist_services_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_dentist_services UNIQUE (dentist_id, service_id),
    INDEX idx_dentist_services_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dentist_schedule_exceptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dentist_id BIGINT UNSIGNED NOT NULL,
    exception_date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    is_unavailable TINYINT(1) NOT NULL DEFAULT 0,
    reason VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_schedule_exceptions_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_schedule_exceptions_interval CHECK (is_unavailable = 1 OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)),
    INDEX idx_schedule_exceptions_lookup (dentist_id, exception_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Associate active dentists with active dental services
INSERT INTO dentist_services (dentist_id, service_id, is_primary)
SELECT d.id, s.id, 1
FROM dentists d
CROSS JOIN services s
WHERE d.is_active = 1 AND s.is_active = 1
ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary);
