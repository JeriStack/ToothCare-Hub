-- Migration 020: Create treatment_record_versions table
-- Implements immutable versioning for clinical documentation amendments, preserving forensic history.

CREATE TABLE IF NOT EXISTS treatment_record_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    treatment_record_id BIGINT UNSIGNED NOT NULL,
    version_number INT UNSIGNED NOT NULL DEFAULT 1,
    teeth_treated JSON NULL,
    diagnosis TEXT NOT NULL,
    procedure_notes TEXT NOT NULL,
    prescription_notes TEXT NULL,
    home_care_advice TEXT NULL,
    clinical_notes TEXT NULL,
    amended_by_user_id BIGINT UNSIGNED NOT NULL,
    amendment_reason VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_record_versions_record FOREIGN KEY (treatment_record_id) REFERENCES treatment_records(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_record_versions_user FOREIGN KEY (amended_by_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_record_version UNIQUE (treatment_record_id, version_number),
    INDEX idx_record_versions_lookup (treatment_record_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snapshot existing treatment records as version 1
INSERT INTO treatment_record_versions (
    treatment_record_id,
    version_number,
    teeth_treated,
    diagnosis,
    procedure_notes,
    prescription_notes,
    home_care_advice,
    clinical_notes,
    amended_by_user_id,
    amendment_reason,
    created_at
)
SELECT 
    tr.id,
    1,
    tr.teeth_treated,
    tr.diagnosis,
    tr.procedure_notes,
    tr.prescription_notes,
    tr.home_care_advice,
    NULL,
    d.user_id,
    'Initial clinical documentation',
    tr.created_at
FROM treatment_records tr
JOIN dentists d ON tr.dentist_id = d.id
ON DUPLICATE KEY UPDATE version_number = VALUES(version_number);
