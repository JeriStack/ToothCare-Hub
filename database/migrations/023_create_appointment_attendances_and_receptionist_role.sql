-- Migration 023: Create appointment_attendances table and extend users.role to include RECEPTIONIST
-- ToothCare Hub - Front Desk Operations & Arrival Management

-- 1. Alter users.role enum to add RECEPTIONIST
ALTER TABLE users 
MODIFY COLUMN role ENUM('ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT') NOT NULL;

-- 2. Update canonical demo receptionist account (receptionist@toothcare.com) to RECEPTIONIST
UPDATE users 
SET role = 'RECEPTIONIST' 
WHERE email = 'receptionist@toothcare.com';

-- 3. Ensure role_permissions for receptionist are configured
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.slug = 'receptionist' AND p.slug IN (
    'patients.view', 'patients.manage',
    'dentists.view', 'services.view',
    'appointments.view', 'appointments.book', 'appointments.manage'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- 4. Create appointment_attendances table
CREATE TABLE IF NOT EXISTS appointment_attendances (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT UNSIGNED NOT NULL,
    status ENUM('NOT_ARRIVED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'FINISHED', 'NO_SHOW') NOT NULL DEFAULT 'NOT_ARRIVED',
    checked_in_at DATETIME NULL,
    checked_in_by_user_id BIGINT UNSIGNED NULL,
    consultation_started_at DATETIME NULL,
    consultation_ended_at DATETIME NULL,
    notes VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendances_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendances_checked_in_by FOREIGN KEY (checked_in_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_attendances_appointment UNIQUE (appointment_id),
    INDEX idx_attendances_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
