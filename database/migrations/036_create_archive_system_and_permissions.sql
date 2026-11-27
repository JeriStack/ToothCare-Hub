-- Migration 036: Role-Aware Compliance Archive Vault, DRBAC Permissions, and Example Audit Records
-- Provides tamper-evident point-in-time snapshots (SHA-256), healthcare retention policies,
-- reversible soft-archiving for operational records, immutable clinical retention locks,
-- and idempotent example archive records across all 6 clinic audit domains.

CREATE TABLE IF NOT EXISTS archive_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(40) NOT NULL COMMENT 'appointment | treatment_record | patient | dentist | service | user',
    entity_id BIGINT UNSIGNED NOT NULL,
    reference_code VARCHAR(64) NOT NULL,
    title VARCHAR(191) NOT NULL,
    summary VARCHAR(500) NULL,
    owner_patient_id BIGINT UNSIGNED NULL COMMENT 'Enables strict Patient ownership scoping',
    owner_dentist_id BIGINT UNSIGNED NULL COMMENT 'Enables strict Dentist ownership scoping',
    owner_user_id BIGINT UNSIGNED NULL COMMENT 'Enables User-level ownership scoping',
    status VARCHAR(32) NOT NULL DEFAULT 'ARCHIVED' COMMENT 'ARCHIVED | RESTORED | LOCKED_RETENTION',
    retention_category VARCHAR(32) NOT NULL DEFAULT 'OPERATIONAL_3Y' COMMENT 'CLINICAL_7Y | OPERATIONAL_3Y | ACCOUNT_5Y | CATALOG_LEGACY',
    retention_until DATE NULL,
    archive_reason VARCHAR(500) NOT NULL,
    archived_by_user_id BIGINT UNSIGNED NULL,
    archived_by_role VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
    archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_by_user_id BIGINT UNSIGNED NULL,
    restored_at DATETIME NULL,
    restore_reason VARCHAR(500) NULL,
    snapshot_json LONGTEXT NOT NULL,
    snapshot_sha256 CHAR(64) NOT NULL,
    is_example TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_archive_reference_code (reference_code),
    INDEX idx_archive_entity (entity_type, entity_id, status),
    INDEX idx_archive_status_archived_at (status, archived_at, id),
    INDEX idx_archive_patient (owner_patient_id, archived_at),
    INDEX idx_archive_dentist (owner_dentist_id, archived_at),
    INDEX idx_archive_retention (retention_category, retention_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DRBAC Permissions for the Archive System
INSERT INTO permissions (name, slug, module, description) VALUES
('View Archives', 'archives.view', 'archives', 'Inspect role-scoped archived clinic, clinical, and operational records'),
('Archive Records', 'archives.create', 'archives', 'Soft-archive eligible clinic records with a mandatory audit reason and retention tag'),
('Restore Archived Records', 'archives.restore', 'archives', 'Restore reversible soft-archived records back to active clinic operations (excludes immutable clinical locks)'),
('Export Archive Reports', 'archives.export', 'archives', 'Export filtered role-scoped archive records to CSV for compliance audits')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    module = VALUES(module),
    description = VALUES(description);

-- Administrator: Full Archive Governance (view, create, restore, export)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN ('archives.view', 'archives.create', 'archives.restore', 'archives.export')
WHERE r.slug = 'admin'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;

-- Receptionist: Front-Desk Operational Archives (view, create, export — no restore for separation of duties)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN ('archives.view', 'archives.create', 'archives.export')
WHERE r.slug = 'receptionist'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;

-- Dentist: Clinical Case & Locked Treatment Archive (view, create — own assigned records only)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN ('archives.view', 'archives.create')
WHERE r.slug = 'dentist'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;

-- Patient: Personal Historical Visit & Summary Archive (read-only view of own records)
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN ('archives.view')
WHERE r.slug = 'patient'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;

-- Idempotent Example Archive Records across all 6 audit domains (flagged is_example = 1)
-- Snapshot SHA-256 digests match exact JSON payloads so integrity verification reports Verified out of the box.
INSERT INTO archive_records (
    entity_type, entity_id, reference_code, title, summary,
    owner_patient_id, owner_dentist_id, owner_user_id,
    status, retention_category, retention_until,
    archive_reason, archived_by_user_id, archived_by_role, archived_at,
    snapshot_json, snapshot_sha256, is_example
) VALUES
(
    'appointment', 9001, 'ARC-EX-APT-001',
    'Completed Visit — Dental Prophylaxis (Example)',
    'Completed preventive cleaning visit archived after 90-day post-visit operational closeout.',
    NULL, NULL, NULL,
    'ARCHIVED', 'OPERATIONAL_3Y', '2029-11-15',
    'Quarterly operational archive of resolved clinic appointments (example record).',
    NULL, 'RECEPTIONIST', '2026-11-15 17:30:00',
    '{"appointment_id":9001,"service_name":"Dental Prophylaxis (Cleaning)","dentist_name":"Dr. Maria Santos","patient_name":"Juan Dela Cruz (Example)","start_at":"2026-08-12 09:00:00","status":"COMPLETED","operatory_chair":"Operatory Chair 1"}',
    SHA2('{"appointment_id":9001,"service_name":"Dental Prophylaxis (Cleaning)","dentist_name":"Dr. Maria Santos","patient_name":"Juan Dela Cruz (Example)","start_at":"2026-08-12 09:00:00","status":"COMPLETED","operatory_chair":"Operatory Chair 1"}', 256),
    1
),
(
    'treatment_record', 9002, 'ARC-EX-TR-001',
    'Locked Clinical Chart — Composite Restoration #14 (Example)',
    '24-hour compliance-locked clinical note with FDI tooth charting and post-op advice.',
    NULL, NULL, NULL,
    'LOCKED_RETENTION', 'CLINICAL_7Y', '2033-11-10',
    'Automatic 24h clinical immutability lock for 7-year dental record retention (example record).',
    NULL, 'DENTIST', '2026-11-10 14:00:00',
    '{"treatment_record_id":9002,"service_name":"Composite Tooth Filling","dentist_name":"Dr. Roberto Reyes","patient_name":"Maria Garcia (Example)","teeth_treated":["14"],"diagnosis":"Class II mesio-occlusal caries on tooth #14","procedure_notes":"Caries excavation completed; resin composite placed and light-cured.","home_care_advice":"Avoid hard chewing on upper right quadrant for 24 hours."}',
    SHA2('{"treatment_record_id":9002,"service_name":"Composite Tooth Filling","dentist_name":"Dr. Roberto Reyes","patient_name":"Maria Garcia (Example)","teeth_treated":["14"],"diagnosis":"Class II mesio-occlusal caries on tooth #14","procedure_notes":"Caries excavation completed; resin composite placed and light-cured.","home_care_advice":"Avoid hard chewing on upper right quadrant for 24 hours."}', 256),
    1
),
(
    'patient', 9003, 'ARC-EX-PAT-001',
    'Inactive Patient Profile — Elena Navarro (Example)',
    'Relocated patient profile archived under 5-year Data Privacy Act retention schedule.',
    NULL, NULL, NULL,
    'ARCHIVED', 'ACCOUNT_5Y', '2031-10-20',
    'Patient relocated overseas and requested account deactivation with clinical history retention (example record).',
    NULL, 'ADMIN', '2026-10-20 11:15:00',
    '{"patient_id":9003,"full_name":"Elena Navarro (Example)","gender":"FEMALE","phone":"+63 917 000 0000","medical_alerts":"Penicillin allergy","account_status":"INACTIVE"}',
    SHA2('{"patient_id":9003,"full_name":"Elena Navarro (Example)","gender":"FEMALE","phone":"+63 917 000 0000","medical_alerts":"Penicillin allergy","account_status":"INACTIVE"}', 256),
    1
),
(
    'dentist', 9004, 'ARC-EX-DNT-001',
    'Retired Practitioner — Dr. Arturo Mendoza (Example)',
    'Retired orthodontist credential and PRC license record retained for clinical audit traceability.',
    NULL, NULL, NULL,
    'ARCHIVED', 'ACCOUNT_5Y', '2031-09-30',
    'Practitioner retirement offboarding; historical clinical records remain linked (example record).',
    NULL, 'ADMIN', '2026-09-30 18:00:00',
    '{"dentist_id":9004,"full_name":"Dr. Arturo Mendoza (Example)","specialization":"Orthodontics","license_number":"PRC-EX-004812","default_operatory_chair":"Operatory Chair 3","is_active":0}',
    SHA2('{"dentist_id":9004,"full_name":"Dr. Arturo Mendoza (Example)","specialization":"Orthodontics","license_number":"PRC-EX-004812","default_operatory_chair":"Operatory Chair 3","is_active":0}', 256),
    1
),
(
    'service', 9005, 'ARC-EX-SRV-001',
    'Discontinued Procedure — Legacy Amalgam Filling (Example)',
    'Retired catalog service preserved to maintain historical appointment price and duration snapshots.',
    NULL, NULL, NULL,
    'ARCHIVED', 'CATALOG_LEGACY', '2029-09-01',
    'Replaced by mercury-free composite restoration protocol; preserved for billing & reporting history (example record).',
    NULL, 'ADMIN', '2026-09-01 09:00:00',
    '{"service_id":9005,"name":"Legacy Amalgam Filling (Example)","category":"Restorative","duration_minutes":45,"price":1200,"is_active":0}',
    SHA2('{"service_id":9005,"name":"Legacy Amalgam Filling (Example)","category":"Restorative","duration_minutes":45,"price":1200,"is_active":0}', 256),
    1
),
(
    'user', 9006, 'ARC-EX-USR-001',
    'Deactivated Staff Account — former.desk@toothcare.example (Example)',
    'Offboarded front-desk account archived for access-control and DRBAC compliance auditing.',
    NULL, NULL, NULL,
    'ARCHIVED', 'ACCOUNT_5Y', '2031-10-05',
    'Employee offboarding completed; credentials revoked and audit attribution retained (example record).',
    NULL, 'ADMIN', '2026-10-05 16:45:00',
    '{"user_id":9006,"email":"former.desk@toothcare.example","role":"RECEPTIONIST","is_active":0,"email_verified":1}',
    SHA2('{"user_id":9006,"email":"former.desk@toothcare.example","role":"RECEPTIONIST","is_active":0,"email_verified":1}', 256),
    1
)
ON DUPLICATE KEY UPDATE
    updated_at = archive_records.updated_at;
