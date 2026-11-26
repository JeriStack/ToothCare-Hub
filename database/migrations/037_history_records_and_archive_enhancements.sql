-- Migration 037: History Records Indexes, Account Archive Categories, Archive Cycle Ledger & DRBAC Permissions
-- Extends existing audit_logs and archive_records without duplicating infrastructure or destroying data.

-- 1. Targeted composite indexes on existing audit_logs for History Records & Individual Record Timelines
CREATE INDEX idx_audit_logs_actor_created ON audit_logs (actor_user_id, created_at, id);
CREATE INDEX idx_audit_logs_target_entity ON audit_logs (target_type, target_id, created_at, id);

-- 2. Enrich archive_records with account_type (PATIENT | DENTIST | RECEPTIONIST | ADMIN) and archived_email
ALTER TABLE archive_records
    ADD COLUMN account_type VARCHAR(32) NULL COMMENT 'PATIENT | DENTIST | RECEPTIONIST | ADMIN (NULL for non-account records)' AFTER entity_id,
    ADD COLUMN archived_email VARCHAR(191) NULL COMMENT 'Preserved account email identifier for Archive Management search & display' AFTER summary;

CREATE INDEX idx_archive_account_type ON archive_records (account_type, status, archived_at, id);
CREATE INDEX idx_archive_archived_by ON archive_records (archived_by_user_id, archived_at);

-- Backfill account_type and archived_email for existing / example account archive records
UPDATE archive_records
SET account_type = 'PATIENT',
    archived_email = COALESCE(archived_email, JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.email')))
WHERE entity_type = 'patient' AND account_type IS NULL;

UPDATE archive_records
SET account_type = 'DENTIST',
    archived_email = COALESCE(archived_email, JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.email')))
WHERE entity_type = 'dentist' AND account_type IS NULL;

UPDATE archive_records
SET account_type = CASE
        WHEN UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.role')), '')) IN ('ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT')
            THEN UPPER(JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.role')))
        ELSE 'ADMIN'
    END,
    archived_email = COALESCE(archived_email, JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.email')))
WHERE entity_type = 'user' AND account_type IS NULL;

-- Ensure seeded example Patient & Dentist records carry clean synthetic emails for Archive Management display
UPDATE archive_records
SET archived_email = 'elena.navarro.example@toothcare.example'
WHERE reference_code = 'ARC-EX-PAT-001' AND (archived_email IS NULL OR archived_email = '' OR archived_email = 'null');

UPDATE archive_records
SET archived_email = 'arturo.mendoza.example@toothcare.example'
WHERE reference_code = 'ARC-EX-DNT-001' AND (archived_email IS NULL OR archived_email = '' OR archived_email = 'null');

-- 3. Append-only Archive Cycle Ledger (preserves every archive, restore, and re-archive event across cycles)
CREATE TABLE IF NOT EXISTS archive_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    archive_record_id BIGINT UNSIGNED NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT UNSIGNED NOT NULL,
    account_type VARCHAR(32) NULL,
    event_type VARCHAR(32) NOT NULL COMMENT 'ARCHIVED | RESTORED | REARCHIVED',
    actor_user_id BIGINT UNSIGNED NULL,
    actor_role VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
    reason VARCHAR(500) NOT NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_archive_history_record FOREIGN KEY (archive_record_id) REFERENCES archive_records(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_archive_history_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_archive_history_entity (entity_type, entity_id, created_at, id),
    INDEX idx_archive_history_record (archive_record_id, created_at, id),
    INDEX idx_archive_history_event_time (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill initial archive_history entries for existing archive_records without duplicating
INSERT INTO archive_history (
    archive_record_id, entity_type, entity_id, account_type,
    event_type, actor_user_id, actor_role, reason, metadata, created_at
)
SELECT
    ar.id, ar.entity_type, ar.entity_id, ar.account_type,
    'ARCHIVED', ar.archived_by_user_id, ar.archived_by_role, ar.archive_reason,
    JSON_OBJECT('reference_code', ar.reference_code, 'retention_category', ar.retention_category, 'is_example', ar.is_example),
    ar.archived_at
FROM archive_records ar
LEFT JOIN archive_history ah
    ON ah.archive_record_id = ar.id AND ah.event_type = 'ARCHIVED'
WHERE ah.id IS NULL;

INSERT INTO archive_history (
    archive_record_id, entity_type, entity_id, account_type,
    event_type, actor_user_id, actor_role, reason, metadata, created_at
)
SELECT
    ar.id, ar.entity_type, ar.entity_id, ar.account_type,
    'RESTORED', ar.restored_by_user_id, 'ADMIN', COALESCE(ar.restore_reason, 'Restored by administrator'),
    JSON_OBJECT('reference_code', ar.reference_code),
    ar.restored_at
FROM archive_records ar
LEFT JOIN archive_history ah
    ON ah.archive_record_id = ar.id AND ah.event_type = 'RESTORED'
WHERE ar.restored_at IS NOT NULL AND ah.id IS NULL;

-- 4. Granular DRBAC Permissions for History Records & Archive Cycle History
INSERT INTO permissions (name, slug, module, description) VALUES
('View History Records', 'history.view', 'history', 'Access chronological system and account history records scoped by role'),
('View History Event Details', 'history.view_details', 'history', 'Inspect structured event metadata and previous/updated value comparisons'),
('View Patient History', 'history.view_patient', 'history', 'View chronological lifecycle history for authorized patient accounts'),
('View Staff History', 'history.view_staff', 'history', 'View chronological operational and administrative history for staff accounts'),
('View Appointment History', 'history.view_appointment', 'history', 'View chronological lifecycle, schedule, and dentist reassignment history for appointments'),
('View Archive Cycle History', 'archives.view_history', 'archives', 'Inspect multi-cycle archival and restoration timelines for archived records')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    module = VALUES(module),
    description = VALUES(description);

-- Administrator: Full History Records & Archive History access
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN (
    'history.view', 'history.view_details', 'history.view_patient',
    'history.view_staff', 'history.view_appointment', 'archives.view_history'
)
WHERE r.slug = 'admin'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;

-- Receptionist: Operational Patient & Appointment History + own Staff History + Archive History
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN (
    'history.view', 'history.view_details', 'history.view_patient',
    'history.view_appointment', 'archives.view_history'
)
WHERE r.slug = 'receptionist'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;

-- Dentist: Own assigned Appointment & Patient operational history + Archive History
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN (
    'history.view', 'history.view_details', 'history.view_appointment', 'archives.view_history'
)
WHERE r.slug = 'dentist'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;

-- Patient: Own Account & Appointment history + Archive History
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, NOW()
FROM roles r
JOIN permissions p ON p.slug IN (
    'history.view', 'history.view_details', 'history.view_patient',
    'history.view_appointment', 'archives.view_history'
)
WHERE r.slug = 'patient'
ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id;
