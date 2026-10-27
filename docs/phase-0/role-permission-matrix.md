# ToothCare Hub — Role and Permission Matrix

**Document ID:** `TCH-P0-RBAC-001`  
**Version:** `1.0`  
**Phase:** `Phase 0 — Project Initiation and Scope Freeze`  
**Prepared Date:** `2026-10-27`  
**Status:** `Approved (Phase 0 Baseline)`

---

## 1. Core Authorization Principles

1. **Server-Side Enforcement Mandatory:** Hiding links or buttons in React is a usability convenience only. Every `/api/v1/*` request must re-verify authentication (`401 Unauthorized` if missing/invalid) and role + resource ownership (`403 Forbidden` if unauthorized) in PHP middleware and service layers.
2. **Default Deny:** Any route or action not explicitly granted to a role in this matrix is denied by default.
3. **No Public Role Escalation:** `POST /api/v1/auth/register` always creates a `PATIENT` account. `ADMIN` and `DENTIST` accounts can only be provisioned or activated through an authorized administrative process or seeded migration.
4. **Object-Level Ownership (IDOR Defense):**
   - A `PATIENT` may only read/modify records where `patient.user_id === session.user_id`.
   - A `DENTIST` may only read appointment details, patient visit context, and author treatment records where `appointment.dentist_id === session.dentist_id`.
5. **Approved Role Modeling (`DEC-ROLE-001`):**
   - **Approved MVP Decision (`2026-10-27`):** **Admin / Receptionist** is modeled as a single unified operational role (`ADMIN`) for the single-clinic MVP, matching the System Development Plan v1.1 (§3) and Detailed Roadmap v1.2.
   - Section 3 preserves the sub-role boundary documentation should a future release introduce a separate `RECEPTIONIST` role.

---

## 2. Resource & Operation Permission Matrix

**Legend:**
- **C** = Create | **R** = Read | **U** = Update | **D** = Deactivate / Soft-Delete (Hard delete restricted where historical FKs exist)
- **Own** = Restricted to caller's own `user_id` / `patient_id`
- **Assigned** = Restricted to records linked to caller's `dentist_id`
- **No** = Explicitly Forbidden (`403 Forbidden` / `401 Unauthorized`)

| Resource / Domain | Operation / Endpoint Scope | Public (Unauthenticated) | Patient (`PATIENT`) | Dentist (`DENTIST`) | Admin / Receptionist (`ADMIN`) | Backend Enforcement Rule |
|---|---|---|---|---|---|---|
| **Authentication & Session** | Register patient account (`POST /auth/register`) | **C** (`PATIENT` only) | No | No | No (Uses Admin CRUD) | Hardcode `role = 'PATIENT'` server-side. |
| | Login / Logout / Verify Email / Password Reset | **C / U** | **C / U** (Own) | **C / U** (Own) | **C / U** (Own) | Rate-limited; single-use hashed tokens. |
| **Patient Profiles** (`patients`) | View profile (`GET /me`, `GET /patients/{id}`) | No | **R** (Own only) | **R** (Assigned visit context only) | **R** (All clinic patients) | Dentist query must join `appointments` on `dentist_id`; exclude unrelated patients. |
| | Update profile (`PATCH /patients/{id}`) | No | **U** (Own permitted fields) | No | **C / U / D** (Permitted operational fields) | Patient cannot alter `is_active` or `user_id`. |
| **Dentist Profiles** (`dentists`) | Browse active dentists (`GET /dentists`) | **R** (Active only, public fields) | **R** (Active only, public fields) | **R** (Own full + Active directory) | **R** (All, active & inactive) | Public/Patient response strips internal admin metadata. |
| | Create / Update / Activate / Deactivate Dentist | No | No | **R** (Own profile; request edits via clinic) | **C / U / D** (`is_active` toggle) | `RESTRICT` physical deletion if appointments exist; use `is_active = 0`. |
| **Dental Services & Prices** (`services`) | Browse services (`GET /services`) | **R** (Active only) | **R** (Active only) | **R** (All / Active details) | **R** (All, active & inactive) | Loaded dynamically on Landing Page & Booking Wizard. |
| | Create / Update / Activate / Deactivate Service | No | No | No | **C / U / D** (`is_active` toggle) | Changes do not overwrite `price_snapshot` or `duration_snapshot` on past bookings. |
| **Dentist Working Schedules & Time Off** (`dentist_schedules`, `dentist_time_off`) | View working schedule / time off | No (Uses `/availability`) | No (Uses `/availability`) | **R** (Own schedule & time off) | **R** (All dentists) | Patients only see computed bookable slots, not raw staff leave reasons. |
| | Configure recurring hours & blocked periods | No | No | No | **C / U / D** | Validates `start_time < end_time` and weekday bounds. |
| | Query computed available slots (`GET /availability`) | **R** (Advisory preview) | **R** | **R** | **R** | Requires active `dentist_id`, active `service_id`, and valid `date`. |
| **Appointment Requests** (`appointments`) | Create appointment request (`POST /appointments`) | No (Redirect to login) | **C** (Own `patient_id` only) | No | **C** (On behalf of patient, audited) | Enforces `SELECT ... FOR UPDATE` slot lock; initial status is `PENDING`. |
| | View appointments (`GET /appointments/me`, `/appointments`, `/appointments/{id}`) | No | **R** (Own only) | **R** (Assigned `dentist_id` only) | **R** (All clinic appointments) | Returns `403` (or policy `404`) if ID does not belong to caller's scope. |
| **Appointment Approval & Rejection** | Approve (`CONFIRMED`) or Reject (`REJECTED`) (`PATCH /appointments/{id}/decision`) | No | No | No *(even for own requests)* | **Approve / Reject** (`PENDING` only) | Only `ADMIN` may transition `PENDING -> CONFIRMED` or `PENDING -> REJECTED`. |
| **Appointment Cancellation & Rescheduling** | Cancel appointment (`PATCH /appointments/{id}/cancel`) | No | **Cancel** (Own `PENDING` or `CONFIRMED` `>= 24h` before `start_at`) | No *(requests admin action per clinic policy)* | **Cancel** (Policy-based admin cancellation with reason) | Releases slot only after transaction commits; logs actor & reason in status history. |
| | Reschedule appointment | No | **Request** (Atomic cancel + new linked `PENDING` request) | No | **U / C** (Atomic reschedule) | Re-runs full availability & overlap lock before committing (`DEC-POL-008`). |
| **Appointment Completion** | Mark visit `COMPLETED` (`PATCH /appointments/{id}/status`) | No | No | **Complete** (Assigned `CONFIRMED` visit only) | **Complete** (Audited operational reconciliation per `DEC-POL-011`) | Precondition: status must be `CONFIRMED` and visit time reached/attended. |
| **Treatment Notes & Records** (`treatment_records`) | Create / Update clinical treatment record (`POST /appointments/{id}/treatment-records`) | No | No | **C / U** (Assigned appointment only; edit rules per `DEC-POL-012`) | No *(Clinical authoring restricted to licensed `DENTIST`)* | Validates caller's `dentist_id === appointment.dentist_id`. |
| | Read treatment records | No | **R** (Own completed visit summary/recommendations per `DEC-POL-012`) | **R** (Assigned appointments/patients only) | **No** for clinical notes (Sees record existence metadata only) | Never transmitted in emails or Socket.IO events. |
| **Appointment History** (`appointment_status_history`) | View status transition timeline | No | **R** (Own appointments) | **R** (Assigned appointments) | **R** (All clinic appointments) | Immutable append-only history written by backend services. |
| **Notifications** (`notifications`, Socket.IO) | List notifications & mark as read (`GET /notifications`, `PATCH /notifications/{id}/read`) | No | **R / U** (Own `recipient_user_id`) | **R / U** (Own `recipient_user_id`) | **R / U** (Own / Admin role notifications) | Socket.IO rooms assigned server-side (`user:<id>`, `role:admin`, `dentist:<id>`). |
| **Reports & Dashboards** | View KPI counts & appointment reports (`GET /admin/reports/appointments`) | No | **R** (Own summary counts only) | **R** (Own schedule & visit counts only) | **R** (Clinic-wide operational reports & filters) | Derived from live parameterized SQL aggregations. |
| **User Account & Role Administration** (`users`) | Create staff/dentist accounts, change roles, deactivate users | No | No | No | **Administer** (Authorized `ADMIN` only) | Audited in `audit_logs`; cannot self-lockout last active admin. |
| **Audit Logs & Internal Metrics** (`audit_logs`, `/metrics`) | View security audit trail / scrape metrics | No | No | No | **R** (`audit_logs` for `ADMIN`; `/metrics` internal network only) | Never exposed on public Nginx routes without strict access control. |

---

## 3. Future Extension Note: Optional Sub-Role Split (`ADMIN` vs. `RECEPTIONIST`)

While the MVP unifies Admin/Receptionist under `ADMIN` (`DEC-ROLE-001`), if a future clinic expansion separates Front-Desk Receptionists (`RECEPTIONIST`) from System Administrators (`ADMIN`):
- **Both `ADMIN` and `RECEPTIONIST` may:** Manage patients, view dentist schedules, create/approve/reject/cancel appointments, and view daily operational queues.
- **Only `ADMIN` (and NOT `RECEPTIONIST`) may:** Create/deactivate `DENTIST` or staff user accounts, change user roles, modify service catalog pricing, view security `audit_logs`, and access operational error views.

