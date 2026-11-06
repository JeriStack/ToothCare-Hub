# Phase 10: Security, RBAC, and Data Protection

## 1. Overview
The appointment subsystem handles sensitive Protected Health Information (PHI) including patient identities, diagnostic symptoms, chief complaints, and attendance histories. ToothCare Hub implements defense-in-depth security across authentication, authorization, session validation, and anti-CSRF protection.

---

## 2. Authentication & Session Security

- **Session Isolation:** All appointment actions require an authenticated session established in Phase 7 via `toothcare_session` HttpOnly cookie with `SameSite=Lax` and `Secure` attributes.
- **CSRF Protection:** State-changing HTTP methods (`POST`, `PATCH`, `DELETE`) require a valid `X-CSRF-Token` header matching the token generated in the active session.
- **Session Hijacking Safeguards:** Session cookies are tied to user agent fingerprints and refreshed periodically.

---

## 3. Role-Based Access Control (RBAC) & Ownership Enforcement

### 3.1 Patient Isolation (Horizontal Privilege Separation)
Patients can only view, cancel, or reschedule appointments where `appointment.patient_id == current_patient.id`:
- If Patient A attempts to access `GET /api/v1/appointments/99` owned by Patient B, the backend returns `HTTP 403 Forbidden: You do not have permission to access this appointment.`
- When querying `GET /api/v1/appointments`, the database query is scoped strictly to the authenticated patient's ID (`WHERE patient_id = :patient_id`).

### 3.2 Administrative Privileges
- Endpoints under `/api/v1/admin/appointments/*` require the `ADMIN` role enforced by `AuthorizationMiddleware(['ADMIN'])`.
- Non-admin callers attempting to access triage endpoints receive `HTTP 403 Forbidden: Insufficient permissions.`

---

## 4. Input Validation & Injection Prevention

- **Parameterized Prepared Statements:** 100% of database interactions in `AppointmentRepository` use PDO prepared statements with bound parameters (`:id`, `:patient_id`, `:dentist_id`, `:start_at`, etc.). Zero direct SQL string interpolation is permitted.
- **Strict Format Whitelisting:**
  - Date/time format is verified with `DateTime::createFromFormat('Y-m-d H:i:s', $val)`.
  - Chief complaints and cancellation reasons are stripped of dangerous tags and limited to bounded string lengths (500 and 255 characters respectively).
- **Snapshot Immutability:** Patients cannot inject prices or durations. The server pulls official pricing from `services.price` and duration from `services.duration_minutes`.

---

## 5. Auditability and Non-Repudiation

Every transition is recorded in `appointment_status_history` capturing the exact user ID responsible (`changed_by_user_id`), the timestamp, the previous state, the new state, and the stated reason. Neither patients nor administrators can modify or delete existing status history entries.
