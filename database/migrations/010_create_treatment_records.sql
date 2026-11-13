-- Migration 010: Create treatment_records table
-- Clinical documentation authored exclusively by assigned practitioner with 24h edit window.

CREATE TABLE IF NOT EXISTS treatment_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT UNSIGNED NOT NULL,
    dentist_id BIGINT UNSIGNED NOT NULL,
    patient_id BIGINT UNSIGNED NOT NULL,
    teeth_treated JSON NULL COMMENT 'Array of FDI two-digit tooth notations e.g. [14, 45]',
    diagnosis TEXT NOT NULL,
    procedure_notes TEXT NOT NULL,
    prescription_notes TEXT NULL,
    home_care_advice TEXT NULL,
    locked_at DATETIME NULL COMMENT 'Set to created_at + 24 hours; locks record permanently against edits',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_treatment_records_appointment UNIQUE (appointment_id),
    CONSTRAINT fk_treatment_records_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_treatment_records_dentist FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_treatment_records_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_treatment_records_patient (patient_id, created_at),
    INDEX idx_treatment_records_dentist (dentist_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
