-- ============================================================================
-- ToothCare Hub — Representative Sample SQL Queries
-- Phase 4: Database Modeling and Versioned Schema
-- Database: toothcare_hub (MySQL 8.0 / InnoDB / utf8mb4)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Patient Appointment History
-- Retrieves all past, current, and upcoming appointments for a given patient,
-- joined with service details and dentist practitioner profile.
-- ----------------------------------------------------------------------------
SELECT 
    a.id AS appointment_id,
    a.status,
    a.start_at,
    a.end_at,
    a.duration_snapshot,
    a.price_snapshot,
    s.name AS service_name,
    d.first_name AS dentist_first_name,
    d.last_name AS dentist_last_name,
    d.specialization AS dentist_specialization,
    a.chief_complaint,
    a.cancellation_reason,
    a.created_at
FROM appointments a
INNER JOIN services s ON a.service_id = s.id
INNER JOIN dentists d ON a.dentist_id = d.id
WHERE a.patient_id = 1 -- Parameter: :patient_id
ORDER BY a.start_at DESC;

-- ----------------------------------------------------------------------------
-- 2. Dentist Weekly Working Schedule & Availability
-- Retrieves the defined working shifts for an active dentist.
-- ----------------------------------------------------------------------------
SELECT 
    d.id AS dentist_id,
    d.first_name,
    d.last_name,
    d.license_number,
    ds.day_of_week,
    CASE ds.day_of_week
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END AS day_name,
    ds.start_time,
    ds.end_time,
    ds.is_active
FROM dentist_schedules ds
INNER JOIN dentists d ON ds.dentist_id = d.id
WHERE d.id = 1 -- Parameter: :dentist_id
  AND ds.is_active = 1
ORDER BY ds.day_of_week ASC, ds.start_time ASC;

-- ----------------------------------------------------------------------------
-- 3. Dentist Daily Agenda / Upcoming Appointments
-- Retrieves a dentist's scheduled visits for a specific calendar day,
-- excluding cancelled or rejected bookings.
-- ----------------------------------------------------------------------------
SELECT 
    a.id AS appointment_id,
    a.status,
    TIME(a.start_at) AS appointment_time,
    a.start_at,
    a.end_at,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    p.phone AS patient_phone,
    s.name AS service_name,
    a.duration_snapshot,
    a.chief_complaint
FROM appointments a
INNER JOIN patients p ON a.patient_id = p.id
INNER JOIN services s ON a.service_id = s.id
WHERE a.dentist_id = 1 -- Parameter: :dentist_id
  AND a.start_at >= '2026-10-28 00:00:00' -- Parameter: :day_start
  AND a.start_at <  '2026-10-29 00:00:00' -- Parameter: :day_end
  AND a.status NOT IN ('CANCELLED', 'REJECTED')
ORDER BY a.start_at ASC;

-- ----------------------------------------------------------------------------
-- 4. Pending Appointment Review Queue (Admin / Receptionist)
-- Retrieves all pending appointment requests awaiting triage and confirmation,
-- ordered by creation timestamp (FIFO queue).
-- ----------------------------------------------------------------------------
SELECT 
    a.id AS appointment_id,
    a.created_at AS requested_at,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    u.email AS patient_email,
    p.phone AS patient_phone,
    s.name AS service_name,
    a.duration_snapshot,
    d.first_name AS dentist_first_name,
    d.last_name AS dentist_last_name,
    a.start_at AS requested_slot_start,
    a.end_at AS requested_slot_end,
    a.chief_complaint
FROM appointments a
INNER JOIN patients p ON a.patient_id = p.id
INNER JOIN users u ON p.user_id = u.id
INNER JOIN services s ON a.service_id = s.id
INNER JOIN dentists d ON a.dentist_id = d.id
WHERE a.status = 'PENDING'
ORDER BY a.created_at ASC;

-- ----------------------------------------------------------------------------
-- 5. Canonical Slot Overlap Detector (Covering Index Range Scan)
-- Tests whether an interval [start_at, end_at) conflicts with any existing
-- blocking appointments (PENDING or CONFIRMED) for the selected dentist.
-- ----------------------------------------------------------------------------
SELECT 
    a.id,
    a.status,
    a.start_at,
    a.end_at
FROM appointments a
WHERE a.dentist_id = 1 -- Parameter: :dentist_id
  AND a.status IN ('PENDING', 'CONFIRMED')
  AND a.start_at < '2026-10-28 10:00:00' -- Parameter: :requested_end
  AND a.end_at   > '2026-10-28 09:00:00' -- Parameter: :requested_start
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 6. Dentist Approved Time-Off Overlap Check
-- Checks if a dentist has an approved leave/time-off covering the requested slot.
-- ----------------------------------------------------------------------------
SELECT 
    dto.id,
    dto.reason,
    dto.start_at,
    dto.end_at,
    dto.approved_by_user_id
FROM dentist_time_off dto
WHERE dto.dentist_id = 2 -- Parameter: :dentist_id
  AND dto.start_at < '2026-11-20 18:00:00' -- Parameter: :requested_end
  AND dto.end_at   > '2026-11-15 08:00:00' -- Parameter: :requested_start
LIMIT 1;

-- ----------------------------------------------------------------------------
-- 7. Unread In-App Notifications for a User
-- Retrieves active unread notifications with badge count.
-- ----------------------------------------------------------------------------
SELECT 
    n.id AS notification_id,
    n.role,
    n.type,
    n.title,
    n.message,
    n.reference_type,
    n.reference_id,
    n.created_at
FROM notifications n
WHERE n.user_id = 4 -- Parameter: :user_id
  AND n.read_at IS NULL
ORDER BY n.created_at DESC
LIMIT 20;

-- ----------------------------------------------------------------------------
-- 8. Email Outbox Background Worker Poll (with Skip-Locked Row Concurrency)
-- Demonstrates non-blocking queue polling for asynchronous mail delivery.
-- ----------------------------------------------------------------------------
SELECT 
    eo.id,
    eo.recipient_email,
    eo.recipient_name,
    eo.subject,
    eo.body_html,
    eo.attempts,
    eo.max_attempts
FROM email_outbox eo
WHERE eo.status = 'PENDING'
  AND (eo.next_attempt_at IS NULL OR eo.next_attempt_at <= NOW())
  AND eo.attempts < eo.max_attempts
ORDER BY eo.next_attempt_at ASC, eo.id ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;

-- ----------------------------------------------------------------------------
-- 9. Comprehensive Appointment Status Audit History
-- Traces complete chronological state transitions for an appointment,
-- identifying the actor, timestamp, and audit rationale.
-- ----------------------------------------------------------------------------
SELECT 
    ash.id AS history_id,
    ash.appointment_id,
    ash.old_status,
    ash.new_status,
    ash.created_at AS changed_at,
    ash.reason,
    u.id AS actor_user_id,
    u.email AS actor_email,
    u.role AS actor_role
FROM appointment_status_history ash
LEFT JOIN users u ON ash.actor_user_id = u.id
WHERE ash.appointment_id = 2 -- Parameter: :appointment_id
ORDER BY ash.created_at ASC, ash.id ASC;

-- ----------------------------------------------------------------------------
-- 10. Patient Longitudinal Clinical Treatment History
-- Retrieves authorized treatment notes, diagnoses, and prescriptions
-- recorded during completed appointments for a specific patient.
-- ----------------------------------------------------------------------------
SELECT 
    tr.id AS treatment_record_id,
    a.id AS appointment_id,
    a.start_at AS appointment_date,
    s.name AS procedure_performed,
    d.first_name AS dentist_first_name,
    d.last_name AS dentist_last_name,
    tr.diagnosis,
    tr.procedure_notes,
    tr.prescription_notes,
    tr.home_care_advice,
    tr.locked_at,
    tr.created_at AS recorded_at
FROM treatment_records tr
INNER JOIN appointments a ON tr.appointment_id = a.id
INNER JOIN services s ON a.service_id = s.id
INNER JOIN dentists d ON tr.dentist_id = d.id
WHERE a.patient_id = 1 -- Parameter: :patient_id
ORDER BY a.start_at DESC;

-- ----------------------------------------------------------------------------
-- 11. Security Audit Log Query
-- Restricted query for administrators reviewing sensitive security actions.
-- ----------------------------------------------------------------------------
SELECT 
    al.id,
    al.action,
    al.target_type,
    al.target_id,
    al.ip_address,
    al.user_agent,
    al.sanitized_payload,
    al.created_at,
    u.email AS actor_email,
    u.role AS actor_role
FROM audit_logs al
LEFT JOIN users u ON al.actor_user_id = u.id
WHERE al.action = 'APPOINTMENT_CONFIRMED' -- Filter by action
ORDER BY al.created_at DESC
LIMIT 50;
