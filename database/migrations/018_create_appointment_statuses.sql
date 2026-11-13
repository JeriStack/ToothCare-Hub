-- Migration 018: Create appointment_statuses lookup table
-- Provides authoritative appointment lifecycle states, descriptions, badge styling, and terminal markers.

CREATE TABLE IF NOT EXISTS appointment_statuses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    status_code VARCHAR(32) NOT NULL,
    label VARCHAR(64) NOT NULL,
    description VARCHAR(255) NULL,
    color_code VARCHAR(20) NOT NULL DEFAULT '#64748B',
    is_terminal TINYINT(1) NOT NULL DEFAULT 0,
    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_appointment_statuses_code UNIQUE (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed canonical appointment states matching ToothCare Hub clinical workflows
INSERT INTO appointment_statuses (status_code, label, description, color_code, is_terminal, display_order) VALUES
('PENDING', 'Pending Review', 'Appointment requested by patient awaiting clinic triage and confirmation', '#F59E0B', 0, 1),
('CONFIRMED', 'Confirmed', 'Appointment confirmed by clinic staff and allocated to dentist operatory', '#0D9488', 0, 2),
('REJECTED', 'Rejected', 'Appointment request declined due to schedule conflict or clinic policy', '#EF4444', 1, 3),
('CANCELLED', 'Cancelled', 'Appointment cancelled by patient or clinic with documented rationale', '#6B7280', 1, 4),
('COMPLETED', 'Completed', 'Clinical visit completed with dental procedure documented', '#10B981', 1, 5)
ON DUPLICATE KEY UPDATE 
    label = VALUES(label),
    description = VALUES(description),
    color_code = VALUES(color_code),
    is_terminal = VALUES(is_terminal),
    display_order = VALUES(display_order);
