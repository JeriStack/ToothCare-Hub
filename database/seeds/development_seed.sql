-- =============================================================================
-- ToothCare Hub - Synthetic Development Seed Dataset
-- 
-- ENVIRONMENT: Development and Automated Testing ONLY.
-- WARNING: Never execute this script against Staging or Production databases.
-- All data is completely synthetic and uses reserved example domains (*.example.com / *.toothcare.local).
-- Default seed password for all accounts: 'Password123!'
-- Hash generated via Argon2id: $argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Seed Users (Admin, Receptionist, Dentists, Patients)
INSERT INTO users (id, email, password_hash, role, is_active, email_verified, email_verified_at, created_at)
VALUES
    -- Administrative Staff
    (1, 'admin@toothcare.local', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'ADMIN', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    (2, 'receptionist@toothcare.local', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'ADMIN', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    -- Licensed Dentists
    (3, 'dr.santos@toothcare.local', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'DENTIST', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    (4, 'dr.reyes@toothcare.local', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'DENTIST', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    (5, 'dr.lim@toothcare.local', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'DENTIST', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    -- Patients
    (6, 'patient.juan@example.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'PATIENT', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    (7, 'patient.maria@example.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'PATIENT', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    (8, 'patient.elena@example.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'PATIENT', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00'),
    (9, 'patient.roberto@example.com', '$argon2id$v=19$m=65536,t=4,p=1$dk5Db1RlYWJqVEtmZEJYTA$f0yOFk2YpzgkhmdL+sQ0AWQsW2J9gSS3O2frrh7VJgI', 'PATIENT', 1, 1, '2026-10-01 08:00:00', '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2. Seed Dentists Profiles
INSERT INTO dentists (id, user_id, first_name, last_name, specialization, license_number, phone, default_operatory_chair, bio, is_active, created_at)
VALUES
    (1, 3, 'Maria', 'Santos', 'General & Cosmetic Dentistry', 'PRC-008472', '+639175551234', 'Operatory Chair 1', 'Specialist in preventive oral prophylaxis, esthetic restorations, and cosmetic veneers.', 1, '2026-10-01 08:00:00'),
    (2, 4, 'Roberto', 'Reyes', 'Orthodontics & Restorative', 'PRC-009124', '+639185554321', 'Operatory Chair 2', 'Consultant orthodontist focusing on interceptive alignment and composite reconstructions.', 1, '2026-10-01 08:00:00'),
    (3, 5, 'Carmela', 'Lim', 'Endodontics & Micro-Dentistry', 'PRC-007812', '+639205559876', 'Operatory Chair 3', 'Micro-endodontic specialist handling complex multi-rooted root canal therapies.', 1, '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 3. Seed Patients Profiles
INSERT INTO patients (id, user_id, first_name, last_name, date_of_birth, phone, gender, address, emergency_contact_name, emergency_contact_phone, medical_alerts, created_at)
VALUES
    (1, 6, 'Juan', 'Dela Cruz', '1994-05-18', '+639171234567', 'MALE', '124 Ayala Avenue, Makati City', 'Elena Dela Cruz (Spouse)', '+639177654321', 'None recorded', '2026-10-01 08:00:00'),
    (2, 7, 'Maria', 'Garcia', '1988-11-23', '+639189876543', 'FEMALE', '55 Buendia Ave, Pasay City', 'Carlos Garcia (Brother)', '+639181112233', 'None recorded', '2026-10-01 08:00:00'),
    (3, 8, 'Elena', 'Gomez', '1996-04-12', '+639194443322', 'FEMALE', '88 Shaw Blvd, Mandaluyong City', 'Teresa Gomez (Mother)', '+639199998877', 'Penicillin (Severe anaphylactic rash/swelling)', '2026-10-01 08:00:00'),
    (4, 9, 'Roberto', 'Tan', '2001-08-30', '+639225551234', 'MALE', '12 Ortigas Center, Pasig City', 'Grace Tan (Sister)', '+639223334455', 'Mild asthma, carries salbutamol inhaler', '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 4. Seed Services Catalog
INSERT INTO services (id, name, category, description, price, duration_minutes, is_active, created_at)
VALUES
    (1, 'Dental Prophylaxis (Cleaning)', 'Preventive', 'Comprehensive supra- and subgingival scaling, polishing, and topical fluoride application.', 1500.00, 45, 1, '2026-10-01 08:00:00'),
    (2, 'Composite Tooth Filling', 'Restorative', 'Tooth-colored nanohybrid resin restoration for anterior or posterior carious lesions.', 1800.00, 45, 1, '2026-10-01 08:00:00'),
    (3, 'In-Office Teeth Whitening', 'Cosmetic', 'Chairside laser-activated hydrogen peroxide bleaching producing 6 to 8 shade improvements.', 7500.00, 60, 1, '2026-10-01 08:00:00'),
    (4, 'Root Canal Therapy (Anterior)', 'Restorative', 'Pulp extirpation, canal instrumentation, chemical debridement, and gutta-percha obturation.', 8000.00, 90, 1, '2026-10-01 08:00:00'),
    (5, 'Simple Tooth Extraction', 'Oral Surgery', 'Elevation and luxation extraction of non-restorable single-rooted tooth under local anesthesia.', 1200.00, 30, 1, '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 5. Seed Dentist Schedules (Recurring Weekly Shifts in Asia/Manila)
-- Monday to Friday: Morning 09:00 - 12:00, Afternoon 13:00 - 17:00 (12:00 - 13:00 is lunch break)
INSERT INTO dentist_schedules (id, dentist_id, day_of_week, start_time, end_time, operatory_chair, is_active, created_at)
VALUES
    -- Dr. Maria Santos (Mon, Tue, Thu, Fri)
    (1, 1, 1, '09:00:00', '12:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),
    (2, 1, 1, '13:00:00', '17:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),
    (3, 1, 2, '09:00:00', '12:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),
    (4, 1, 2, '13:00:00', '17:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),
    (5, 1, 4, '09:00:00', '12:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),
    (6, 1, 4, '13:00:00', '17:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),
    (7, 1, 5, '09:00:00', '12:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),
    (8, 1, 5, '13:00:00', '17:00:00', 'Chair 1', 1, '2026-10-01 08:00:00'),

    -- Dr. Roberto Reyes (Tue, Wed, Fri, Sat)
    (9,  2, 2, '09:00:00', '12:00:00', 'Chair 2', 1, '2026-10-01 08:00:00'),
    (10, 2, 2, '13:00:00', '17:00:00', 'Chair 2', 1, '2026-10-01 08:00:00'),
    (11, 2, 3, '09:00:00', '12:00:00', 'Chair 2', 1, '2026-10-01 08:00:00'),
    (12, 2, 3, '13:00:00', '17:00:00', 'Chair 2', 1, '2026-10-01 08:00:00'),
    (13, 2, 5, '09:00:00', '12:00:00', 'Chair 2', 1, '2026-10-01 08:00:00'),
    (14, 2, 5, '13:00:00', '17:00:00', 'Chair 2', 1, '2026-10-01 08:00:00'),
    (15, 2, 6, '09:00:00', '14:00:00', 'Chair 2', 1, '2026-10-01 08:00:00'),

    -- Dr. Carmela Lim (Mon, Wed, Thu, Sat)
    (16, 3, 1, '09:00:00', '17:00:00', 'Chair 3', 1, '2026-10-01 08:00:00'),
    (17, 3, 3, '09:00:00', '17:00:00', 'Chair 3', 1, '2026-10-01 08:00:00'),
    (18, 3, 4, '09:00:00', '17:00:00', 'Chair 3', 1, '2026-10-01 08:00:00'),
    (19, 3, 6, '09:00:00', '14:00:00', 'Chair 3', 1, '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 6. Seed Dentist Time-Off
INSERT INTO dentist_time_off (id, dentist_id, start_at, end_at, reason, approved_by_user_id, created_at)
VALUES
    (1, 1, '2026-11-20 08:00:00', '2026-11-21 18:00:00', 'Attending Philippine Dental Association National Convention', 1, '2026-10-15 10:00:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 7. Seed Appointments (Demonstrating all lifecycle states)
INSERT INTO appointments (
    id, patient_id, dentist_id, service_id, start_at, end_at, duration_snapshot, price_snapshot,
    status, chief_complaint, operatory_chair, rescheduled_from_id, cancellation_reason,
    cancelled_by_user_id, cancelled_at, reviewed_by_user_id, reviewed_at, completed_at, created_at
)
VALUES
    -- 1. Confirmed upcoming visit
    (1042, 1, 1, 1, '2026-11-03 09:30:00', '2026-11-03 10:15:00', 45, 1500.00,
     'CONFIRMED', 'Routine 6-month cleaning, slight sensitivity on lower incisors.', 'Chair 1', NULL, NULL,
     NULL, NULL, 1, '2026-10-27 11:00:00', NULL, '2026-10-27 10:14:00'),

    -- 2. Pending request in review queue
    (1049, 2, 2, 2, '2026-11-17 14:00:00', '2026-11-17 14:45:00', 45, 1800.00,
     'PENDING', 'Filling on upper right molar came loose while eating hard food.', 'Chair 2', NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, '2026-10-27 14:30:00'),

    -- 3. Completed visit with treatment record
    (981, 1, 1, 1, '2026-10-12 10:00:00', '2026-10-12 10:45:00', 45, 1500.00,
     'COMPLETED', 'Routine checkup and preventive scaling.', 'Chair 1', NULL, NULL,
     NULL, NULL, 1, '2026-10-05 09:00:00', '2026-10-12 10:45:00', '2026-10-04 15:00:00'),

    -- 4. Cancelled appointment showing slot release
    (1030, 4, 3, 5, '2026-10-24 11:00:00', '2026-10-24 11:30:00', 30, 1200.00,
     'CANCELLED', 'Severe toothache on lower left second molar.', 'Chair 3', NULL, 'Patient work emergency conflict',
     9, '2026-10-22 09:00:00', 1, '2026-10-20 14:00:00', NULL, '2026-10-20 11:00:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 8. Seed Appointment Status History
INSERT INTO appointment_status_history (id, appointment_id, old_status, new_status, actor_user_id, reason, metadata, created_at)
VALUES
    (1, 1042, NULL, 'PENDING', 6, 'Patient submitted web appointment request', '{"channel": "web"}', '2026-10-27 10:14:00'),
    (2, 1042, 'PENDING', 'CONFIRMED', 1, 'Reception approved request; verified zero schedule conflicts', '{"reviewed_by": "admin"}', '2026-10-27 11:00:00'),
    (3, 1049, NULL, 'PENDING', 7, 'Patient submitted booking request', '{"channel": "web"}', '2026-10-27 14:30:00'),
    (4, 981, NULL, 'PENDING', 6, 'Patient submitted booking request', '{"channel": "web"}', '2026-10-04 15:00:00'),
    (5, 981, 'PENDING', 'CONFIRMED', 1, 'Reception confirmed appointment', '{"channel": "admin"}', '2026-10-05 09:00:00'),
    (6, 981, 'CONFIRMED', 'COMPLETED', 3, 'Attending dentist finished procedure and finalized clinical notes', '{"clinical_record_id": 1}', '2026-10-12 10:45:00'),
    (7, 1030, NULL, 'PENDING', 9, 'Patient requested extraction', '{"channel": "web"}', '2026-10-20 11:00:00'),
    (8, 1030, 'PENDING', 'CONFIRMED', 1, 'Reception confirmed booking', '{"channel": "admin"}', '2026-10-20 14:00:00'),
    (9, 1030, 'CONFIRMED', 'CANCELLED', 9, 'Patient cancelled > 48h prior to visit', '{"cancelled_by": "patient"}', '2026-10-22 09:00:00')
ON DUPLICATE KEY UPDATE id=id;

-- 9. Seed Treatment Records
INSERT INTO treatment_records (
    id, appointment_id, dentist_id, patient_id, teeth_treated, diagnosis, procedure_notes, prescription_notes, home_care_advice, locked_at, created_at
)
VALUES
    (1, 981, 1, 1, JSON_ARRAY(11, 12, 21, 22, 31, 32, 41, 42),
     'Mild localized marginal gingivitis associated with plaque accumulation. No loss of clinical attachment.',
     'Ultrasonic supragingival scaling and subgingival debridement performed. Polishing with fine grit paste and neutral sodium fluoride varnish applied.',
     'None required.',
     'Instructed on Bass brushing technique twice daily and daily dental flossing. Advised 6-month recall visit.',
     '2026-10-13 10:45:00', '2026-10-12 10:45:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 10. Seed Notifications
INSERT INTO notifications (id, user_id, role, type, title, message, reference_type, reference_id, read_at, created_at)
VALUES
    (1, 6, 'PATIENT', 'APPOINTMENT_CONFIRMED', 'Appointment Confirmed!',
     'Your Dental Prophylaxis visit with Dr. Maria Santos on Nov 3 at 09:30 AM has been confirmed by reception.', 'appointments', 1042, NULL, '2026-10-27 11:00:00'),
    (2, 1, 'ADMIN', 'APPOINTMENT_REQUESTED', 'New Booking Request #1049',
     'Maria Garcia requested a Composite Tooth Filling for Nov 17 at 02:00 PM.', 'appointments', 1049, NULL, '2026-10-27 14:30:00'),
    (3, 6, 'PATIENT', 'CLINIC_REMINDER', 'Schedule Reminder',
     'Upcoming clinic visit in 7 days: Nov 3 at 09:30 AM (Operatory Chair 1).', 'appointments', 1042, '2026-10-27 15:00:00', '2026-10-27 14:45:00')
ON DUPLICATE KEY UPDATE id=id;

-- 11. Seed Email Outbox Jobs
INSERT INTO email_outbox (id, user_id, recipient_email, recipient_name, subject, body_html, body_text, status, attempts, max_attempts, next_attempt_at, sent_at, created_at)
VALUES
    (1, 6, 'patient.juan@example.com', 'Juan Dela Cruz', 'Your ToothCare Hub Appointment is Confirmed! (Ref #1042)',
     '<h2>Appointment Confirmed</h2><p>Dear Juan, your appointment with Dr. Maria Santos is confirmed for November 3, 2026 at 09:30 AM.</p>',
     'Dear Juan, your appointment with Dr. Maria Santos is confirmed for November 3, 2026 at 09:30 AM.',
     'SENT', 1, 5, '2026-10-27 11:00:00', '2026-10-27 11:01:05', '2026-10-27 11:00:00'),
    (2, 7, 'patient.maria@example.com', 'Maria Garcia', 'Appointment Request Received (Ref #1049)',
     '<h2>Request Received</h2><p>Dear Maria, we have received your booking request for November 17, 2026 at 02:00 PM. Our reception staff will review it shortly.</p>',
     'Dear Maria, we have received your booking request for November 17, 2026 at 02:00 PM.',
     'SENT', 1, 5, '2026-10-27 14:30:00', '2026-10-27 14:31:12', '2026-10-27 14:30:00')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 12. Seed Auth Tokens
INSERT INTO auth_tokens (id, user_id, token_hash, token_type, expires_at, used_at, created_at)
VALUES
    (1, 6, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'EMAIL_VERIFY', '2026-10-02 08:00:00', '2026-10-01 08:30:00', '2026-10-01 08:00:00'),
    (2, 9, '8743b52063cd84097a65d1633f5c74f5', 'PASSWORD_RESET', '2026-10-28 12:00:00', NULL, '2026-10-27 12:00:00')
ON DUPLICATE KEY UPDATE id=id;

-- 13. Seed Audit Logs
INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, ip_address, user_agent, sanitized_payload, created_at)
VALUES
    (1, 1, 'AUTH_LOGIN_SUCCESS', 'users', 1, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '{"role": "ADMIN"}', '2026-10-27 08:30:00'),
    (2, 1, 'APPOINTMENT_CONFIRMED', 'appointments', 1042, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '{"appointment_id": 1042, "status": "CONFIRMED"}', '2026-10-27 11:00:00'),
    (3, 3, 'TREATMENT_RECORD_CREATED', 'treatment_records', 1, '127.0.0.1', 'Mozilla/5.0 (iPad; CPU OS 17_0)', '{"appointment_id": 981, "dentist_id": 1}', '2026-10-12 10:45:00')
ON DUPLICATE KEY UPDATE id=id;

SET FOREIGN_KEY_CHECKS = 1;
