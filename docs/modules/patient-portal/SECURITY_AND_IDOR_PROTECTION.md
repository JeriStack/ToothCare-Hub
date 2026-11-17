# Security and IDOR Protection Guide

## 1. Threat Model & Ownership Enforcement
ToothCare Hub enforces strict Zero-Trust object-level access controls across all patient endpoints:
- A patient must never access, view, modify, or cancel records belonging to another patient.
- Frontend role guards are strictly complemented by server-side middleware and repository query scoping.

---

## 2. Self-Service Profile Endpoints (`/api/v1/patients/me`)
Rather than relying on client-supplied ID parameters like `/patients/{id}` where malicious actors could manipulate IDs:
1. `GET /api/v1/patients/me` resolves the patient profile exclusively from the authenticated JWT session:
   ```php
   $user = $request->getUser();
   $patient = $this->patientRepository->findByUserId((int) $user['id']);
   ```
2. `PATCH /api/v1/patients/me` updates the authenticated patient's profile directly using the session user ID:
   ```php
   $user = $request->getUser();
   $patient = $this->patientRepository->findByUserId((int) $user['id']);
   $this->patientRepository->update((int) $patient['id'], $sanitizedData);
   ```
3. Path `/api/v1/patients/{id}` remains protected by explicit ownership verification:
   - Admins can inspect/update any patient.
   - Non-admin users can ONLY access `/patients/{id}` if `$patient['user_id'] === (int) $user['id']`. Otherwise, a `403 Forbidden` exception is thrown immediately.

---

## 3. Appointment Scoping & Cancellation Policy
- **Appointment Retrieval (`GET /api/v1/appointments/{id}`)**:
  - The repository query joins `patients p ON a.patient_id = p.id` and selects `p.user_id AS patient_user_id`.
  - Non-admin users are strictly blocked if `$appointment['patient_user_id'] !== $user['id']`.
- **Appointment Cancellation (`POST /api/v1/appointments/{id}/cancel`)**:
  - A patient can only cancel their own appointment.
  - Cancellations are validated against the clinic's 24-hour advance cancellation rule unless the appointment is still in `PENDING` review status.
  - An attempt to cancel another user's appointment aborts with `403 Forbidden`.

---

## 4. In-App Notification Scoping
- Notifications are stored with `user_id`.
- `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, and `POST /api/v1/notifications/read-all` all scope actions strictly by `$user['id']`.
- If Patient A attempts to mark Patient B's notification as read via `PATCH /api/v1/notifications/{id}/read`, the service throws `403 Forbidden`.

---

## 5. Automated Verification
All security and IDOR boundaries are verified via automated integration tests in `backend/tests/Integration/PatientPortalSecurityTest.php`:
1. `testPatientCannotViewAnotherPatientsAppointments`: Verifies `403 Forbidden` when attempting to read another patient's appointment.
2. `testPatientCannotCancelAnotherPatientsAppointment`: Verifies `403 Forbidden` when attempting to cancel another patient's appointment.
3. `testPatientCannotAccessAnotherPatientProfileById`: Verifies `403 Forbidden` on `/patients/{id}` for another patient's record.
4. `testPatientCanAccessOwnProfileViaMeEndpoint`: Verifies `/patients/me` resolves the correct authenticated record.
5. `testPatientCannotAccessAnotherUsersNotification`: Verifies `403 Forbidden` on unauthorized notification updates.
