-- =============================================================================
-- ToothCare Hub - Canonical Demo Accounts (*@toothcare.com)
-- Provides instant login access for Admin, Receptionist, Dentist, and Patient
-- Password for all accounts: Password123!
-- Argon2id hash: $argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Insert Canonical Users
INSERT INTO users (id, email, password_hash, role, is_active, email_verified, email_verified_at, created_at)
VALUES
    (10, 'admin@toothcare.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'ADMIN', 1, 1, NOW(), NOW()),
    (11, 'receptionist@toothcare.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'ADMIN', 1, 1, NOW(), NOW()),
    (12, 'dentist@toothcare.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'DENTIST', 1, 1, NOW(), NOW()),
    (13, 'patient@toothcare.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'PATIENT', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    is_active = 1,
    email_verified = 1;

-- 2. Insert Dentist Profile for dentist@toothcare.com (user_id = 12)
INSERT INTO dentists (id, user_id, first_name, last_name, specialization, license_number, phone, default_operatory_chair, bio, is_active, created_at)
VALUES
    (4, 12, 'Maria', 'Santos', 'General & Cosmetic Dentistry', 'PRC-008472-DEMO', '+639175551234', 'Operatory Chair 1', 'Lead clinic dentist specializing in preventive and cosmetic dentistry.', 1, NOW())
ON DUPLICATE KEY UPDATE
    first_name = VALUES(first_name),
    last_name = VALUES(last_name),
    is_active = 1;

-- 3. Insert Patient Profile for patient@toothcare.com (user_id = 13)
INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone, gender, address, emergency_contact_name, emergency_contact_phone, medical_alerts, created_at)
VALUES
    (5, 13, 'Juan', 'Dela Cruz', '1995-05-18', '+639175559999', 'MALE', '124 Ayala Avenue, Makati City', 'Elena Dela Cruz (Spouse)', '+639177654321', 'None recorded', NOW())
ON DUPLICATE KEY UPDATE
    first_name = VALUES(first_name),
    last_name = VALUES(last_name);

-- 4. Associate Services with Dentist 4
INSERT INTO dentist_services (dentist_id, service_id)
SELECT 4, id FROM services
ON DUPLICATE KEY UPDATE dentist_id = dentist_id;

-- 5. Add Weekly Schedules for Dentist 4 (Mon-Fri 09:00-17:00 with lunch break)
INSERT INTO dentist_schedules (dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active, created_at)
VALUES
    (4, 1, '09:00:00', '12:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 1, '13:00:00', '17:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 2, '09:00:00', '12:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 2, '13:00:00', '17:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 3, '09:00:00', '12:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 3, '13:00:00', '17:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 4, '09:00:00', '12:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 4, '13:00:00', '17:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 5, '09:00:00', '12:00:00', 'Operatory Chair 1', 1, NOW()),
    (4, 5, '13:00:00', '17:00:00', 'Operatory Chair 1', 1, NOW())
ON DUPLICATE KEY UPDATE is_active = 1;

-- 6. Assign Enterprise RBAC Roles (if user_roles table exists)
INSERT INTO user_roles (user_id, role_id)
SELECT 10, id FROM roles WHERE slug = 'admin'
ON DUPLICATE KEY UPDATE user_id = user_id;

INSERT INTO user_roles (user_id, role_id)
SELECT 11, id FROM roles WHERE slug = 'receptionist'
ON DUPLICATE KEY UPDATE user_id = user_id;

INSERT INTO user_roles (user_id, role_id)
SELECT 12, id FROM roles WHERE slug = 'dentist'
ON DUPLICATE KEY UPDATE user_id = user_id;

INSERT INTO user_roles (user_id, role_id)
SELECT 13, id FROM roles WHERE slug = 'patient'
ON DUPLICATE KEY UPDATE user_id = user_id;

-- 7. Seed Sample Clinical Appointments for Dentist 4 (Maria Santos) & Patient 5 (Juan Dela Cruz)
INSERT INTO appointments (id, patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot, status, chief_complaint, operatory_chair, created_at)
VALUES
    (501, 5, 4, 1, DATE_ADD(DATE(NOW()), INTERVAL '14:00:00' HOUR_SECOND), DATE_ADD(DATE(NOW()), INTERVAL '14:45:00' HOUR_SECOND), 45, 1200.00, 'CONFIRMED', 'Routine oral prophylaxis and teeth cleaning', 'Operatory Chair 1', NOW()),
    (502, 5, 4, 2, DATE_ADD(DATE(NOW()), INTERVAL '09:30:00' HOUR_SECOND), DATE_ADD(DATE(NOW()), INTERVAL '10:30:00' HOUR_SECOND), 60, 2500.00, 'COMPLETED', 'Posterior molar filling restoration', 'Operatory Chair 1', NOW()),
    (503, 5, 4, 1, DATE_ADD(DATE_ADD(DATE(NOW()), INTERVAL 1 DAY), INTERVAL '11:00:00' HOUR_SECOND), DATE_ADD(DATE_ADD(DATE(NOW()), INTERVAL 1 DAY), INTERVAL '11:45:00' HOUR_SECOND), 45, 1200.00, 'PENDING', 'Follow-up sensitivity check', 'Operatory Chair 1', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- 8. Seed Sample Time-Off for Dentist 4
INSERT INTO dentist_time_off (id, dentist_id, start_at, end_at, reason, approved_by_user_id, created_at)
VALUES
    (101, 4, DATE_ADD(DATE(NOW()), INTERVAL 14 DAY), DATE_ADD(DATE(NOW()), INTERVAL 16 DAY), 'Annual Dental Convention (CME Continuing Education)', 10, NOW())
ON DUPLICATE KEY UPDATE reason = VALUES(reason);

SET FOREIGN_KEY_CHECKS = 1;
