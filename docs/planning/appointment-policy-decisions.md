# ToothCare Hub — Appointment Policy Decisions & State Model

**Document ID:** `TCH-P0-POL-001`  
**Version:** `1.0`  
**Phase:** `Phase 0 — Project Initiation and Scope Freeze`  
**Prepared Date:** `2026-10-27`  
**Status:** `Approved (Phase 0 Policy Baseline)`

---

## 1. Policy Governance Rule

The 14 appointment policies below directly govern database constraints, slot-calculation algorithms, and state-transition validators. All 7 blocking policy groups and proposed defaults were reviewed and approved by the Project Owner on `2026-10-27`.

---

## 2. Appointment Policy Decision Register (Policies 1–14)

### `DEC-POL-001` — Appointment Durations & Service Variability
- **Policy Question:** Are appointment durations fixed or variable by dental service, and what slot granularity is used?
- **Proposed Default:** **Variable duration per service** (`services.duration_minutes`, e.g., 30, 45, 60, 90 minutes), with candidate start times generated on **30-minute grid intervals** (e.g., `09:00`, `09:30`, `10:00`). At booking creation, `duration_minutes` and `price` are snapshotted onto `appointments` (`duration_snapshot`, `price_snapshot`, and computed `end_at`).
- **Business Impact:** Allows realistic scheduling for short consultations (30 min) vs. root canals or surgical extractions (60–90 min) while protecting historical booking records when service catalog prices/durations change later.
- **Technical Impact:** Requires interval-overlap queries (`existing.start_at < requested_end AND existing.end_at > requested_start`) rather than a simple unique index on `(dentist_id, start_at)`.
- **Decision Owner:** Clinic Owner / Product Owner
- **Approval Status:** **Approved**
- **Final Decision:** Variable durations per service (`duration_minutes`), 30-minute start-time grid, duration and price snapshotted onto `appointments`.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-002` — Booking Window (Minimum Advance Notice & Maximum Horizon)
- **Policy Question:** What is the earliest allowed booking lead time and the maximum advance booking horizon?
- **Proposed Default:**
  - **Minimum Advance Notice:** At least **2 hours** in the future for same-day requests; past timestamps are strictly rejected.
  - **Maximum Advance Horizon:** Up to **60 calendar days** ahead from the current clinic date.
- **Business Impact:** Prevents surprise last-minute bookings that staff cannot review in time and prevents far-future bookings before dentist leave schedules are known.
- **Technical Impact:** Enforced in `AvailabilityService` and `AppointmentValidator` using the explicit clinic timezone (`Asia/Manila`).
- **Decision Owner:** Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** Minimum 2 hours advance notice; maximum 60 calendar days booking horizon.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-003` — Clinic Working Hours, Breaks, Holidays, Time Zone, and Dentist Availability
- **Policy Question:** What time zone governs the clinic, and how are regular hours, lunch breaks, and holidays/leaves represented?
- **Proposed Default:**
  - **Clinic Time Zone:** Explicitly **`Asia/Manila` (`UTC+08:00`, no DST)** for all slot calculations and display formatting.
  - **Recurring Dentist Schedule (`dentist_schedules`):** Configured per dentist per `day_of_week` (`1=Monday` .. `7=Sunday`). Multiple shift rows per day (e.g., `09:00–12:00` and `13:00–17:00`) naturally represent lunch breaks.
  - **Exceptions / Holidays / Leave (`dentist_time_off`):** Date/time interval records (`start_at`, `end_at`, `reason`) that subtract availability from the recurring schedule.
- **Business Impact:** Accurately reflects real Philippine clinic operations, split shifts, and dentist leaves.
- **Technical Impact:** Requires both `dentist_schedules` and `dentist_time_off` tables; requested `[start_at, end_at)` must fall completely inside a single active shift window and have zero overlap with `dentist_time_off`.
- **Decision Owner:** Clinic Owner / Lead Architect
- **Approval Status:** **Approved**
- **Final Decision:** `Asia/Manila` timezone; `dentist_schedules` for recurring weekly shifts and `dentist_time_off` for blocked/leave intervals.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-004` — Do Pending Appointment Requests Block a Time Slot?
- **Policy Question:** When a patient submits a request (`PENDING`), does it immediately reserve/block that dentist's interval against other patients, or remain open until an Admin confirms it?
- **Proposed Default:** **`PENDING` requests immediately block the slot** (alongside `CONFIRMED` appointments).
- **Business Impact:** Prevents multiple patients from requesting the exact same dentist and time slot and avoids forcing Admins to manually reject duplicate competing requests.
- **Technical Impact:** Overlap check filters `WHERE status IN ('PENDING', 'CONFIRMED')`. Combined with `SELECT ... FOR UPDATE`, this guarantees race-free slot reservation at submission time.
- **Decision Owner:** Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** Both `PENDING` and `CONFIRMED` appointments block time slots.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-005` — Pending Request Expiration Policy
- **Policy Question:** Does an unreviewed `PENDING` request automatically expire after a set duration, or remain `PENDING` until an Admin acts (or the appointment start time passes)?
- **Proposed Default:** **No automatic silent expiration before appointment time in MVP**; `PENDING` requests remain in the Admin Priority Queue until approved, rejected, or cancelled. If a `PENDING` request's `start_at` passes without admin action, it is flagged as overdue for admin resolution/cancellation.
- **Business Impact:** Avoids surprising patients with silent system cancellations caused solely by slow receptionist review.
- **Technical Impact:** Simplifies state transitions; keeps all status changes attributable to a human actor or explicit policy rule.
- **Decision Owner:** Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** `PENDING` requests do not silently auto-expire prior to `start_at`; they remain in the Admin queue until decided or cancelled.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-006` — Which Statuses Release a Time Slot?
- **Policy Question:** How do `REJECTED`, `CANCELLED`, and `COMPLETED` statuses affect slot availability?
- **Proposed Default:**
  - **`REJECTED` and `CANCELLED`:** Immediately **release** the time slot upon transaction commit so other patients can book that future interval.
  - **`COMPLETED`:** Represents a finished historical visit; keeps the historical record intact (does not release a past slot for new bookings).
- **Business Impact:** Maximizes clinic utilization when cancellations or rejections occur ahead of time while preserving full audit history.
- **Technical Impact:** Because the overlap query checks `status IN ('PENDING', 'CONFIRMED')`, transitioning a future appointment to `REJECTED` or `CANCELLED` automatically frees the interval without deleting the row.
- **Decision Owner:** Clinic Owner / Lead Architect
- **Approval Status:** **Approved**
- **Final Decision:** `REJECTED` and `CANCELLED` release future slots immediately upon transaction commit.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-007` — Cancellation Deadline and Authorized Actors
- **Policy Question:** Who may cancel an appointment, in which states, and how close to the appointment start time?
- **Proposed Default:**
  - **Patient (`PATIENT`):**
    - May cancel own `PENDING` request at any time before `start_at`.
    - May cancel own `CONFIRMED` appointment up to **24 hours before `start_at`**. Within 24 hours of `start_at`, self-service cancellation is disabled in the UI and rejected by the API (`409 CANCELLATION_WINDOW_PASSED`) with instructions to contact the clinic reception.
  - **Admin / Receptionist (`ADMIN`):**
    - May cancel any `PENDING` or `CONFIRMED` appointment at any time before completion (requires recording a cancellation reason).
  - **Dentist (`DENTIST`):**
    - Cannot directly cancel appointments in self-service MVP; coordinates emergency schedule cancellations through `ADMIN`.
- **Business Impact:** Protects dentists from unannounced last-minute schedule gaps while giving patients fair self-service flexibility.
- **Technical Impact:** Server-side policy check compares `NOW()` (in `Asia/Manila`) against `appointment.start_at - INTERVAL 24 HOUR` when `actor.role === 'PATIENT'` and `appointment.status === 'CONFIRMED'`.
- **Decision Owner:** Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** Patient may cancel `PENDING` anytime and `CONFIRMED` up to 24 hours before `start_at`; `ADMIN` may cancel any `PENDING`/`CONFIRMED` appointment with an audited reason.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-008` — Rescheduling Mechanism (In-Place Update vs. Cancel-and-Rebook)
- **Policy Question:** Does rescheduling modify an existing appointment row in place or cancel the old booking and create a new linked request?
- **Proposed Default:** **Cancel-and-Create Linked Request (Atomic Transaction)**:
  - When a patient or admin reschedules, the backend executes a single transaction that locks the new target dentist/slot, verifies availability, creates a new appointment (with `rescheduled_from_id` FK pointing to the original `appointment_id`), transitions the old appointment to `CANCELLED` (reason: `"Rescheduled to appointment #<new_id>"`), and commits both together so the old slot is never lost if the new slot is unavailable.
- **Business Impact:** Preserves an unmistakable, immutable audit trail of every booking request and never leaves a patient without an appointment if the new slot conflicts.
- **Technical Impact:** Adds nullable `rescheduled_from_id INT UNSIGNED NULL` self-referencing FK on `appointments`.
- **Decision Owner:** Clinic Owner / Lead Architect
- **Approval Status:** **Approved**
- **Final Decision:** Atomic cancel-and-rebook transaction with `rescheduled_from_id` linking the replacement appointment to the cancelled original.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-009` — Does Rescheduling Require Admin Approval?
- **Policy Question:** When a patient reschedules a previously `CONFIRMED` appointment to a new date/time, is the new booking automatically `CONFIRMED` or does it enter `PENDING` for Admin review?
- **Proposed Default:** **Patient-initiated rescheduling enters `PENDING` status** (requires Admin confirmation); **Admin-initiated rescheduling may directly set `CONFIRMED`**.
- **Business Impact:** Ensures clinic staff review all patient-requested schedule changes before locking in a dentist's confirmed calendar.
- **Technical Impact:** Governed by actor role inside `AppointmentService::reschedule()`.
- **Decision Owner:** Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** Patient-initiated rescheduled bookings start in `PENDING` status; Admin-initiated reschedules may be set to `CONFIRMED`.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-010` — Overlapping Appointments and Buffer Time Rules
- **Policy Question:** Are overlapping appointments ever allowed for the same dentist, and is there a mandatory buffer time between back-to-back appointments?
- **Proposed Default:**
  - **Zero overlap allowed** for the same dentist across blocking statuses (`existing.start_at < requested_end AND existing.end_at > requested_start`).
  - **Back-to-back boundary allowed:** An appointment ending at `10:00` does **not** conflict with the next appointment starting at `10:00` (`existing.end_at == requested_start` is valid).
  - **Buffer time:** `0 minutes` additional buffer in MVP (sanitation/turnover time is included within each service's configured `duration_minutes`).
- **Business Impact:** Keeps slot math transparent for patients and avoids unexplained gaps on the calendar.
- **Technical Impact:** Strict inequality `<` and `>` in SQL interval overlap query.
- **Decision Owner:** Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** Strict non-overlap (`existing.start_at < req_end AND existing.end_at > req_start`); adjacent boundary (`end_at == start_at`) permitted; `0 min` extra buffer.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-011` — Who May Mark a Visit `COMPLETED`?
- **Policy Question:** Which role(s) may transition a `CONFIRMED` appointment to `COMPLETED`, and is a treatment record required first?
- **Proposed Default:**
  - **Primary Actor:** The **assigned `DENTIST`** (upon attending the visit / saving `treatment_records`).
  - **Secondary Actor:** An authorized **`ADMIN`** may also mark a `CONFIRMED` visit `COMPLETED` for operational reconciliation (audited in `appointment_status_history`), though only the assigned `DENTIST` may author clinical `treatment_records`.
- **Business Impact:** Prevents administrative bottlenecks at checkout while keeping clinical diagnosis notes strictly under dentist authorship.
- **Technical Impact:** Enforced in `AppointmentService` and `TreatmentRecordService`.
- **Decision Owner:** Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** Assigned `DENTIST` (primary) and authorized `ADMIN` (operational reconciliation) may mark `CONFIRMED -> COMPLETED`; only assigned `DENTIST` may author clinical `treatment_records`.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-012` — Post-Completion Treatment Note Editing & Patient/Admin Visibility
- **Policy Question:** Can a dentist edit treatment notes after a visit is marked `COMPLETED`? Can Patients or Admins view clinical treatment notes?
- **Proposed Default:**
  - **Dentist Editing:** The assigned `DENTIST` may update/amend `treatment_records` within **24 hours of completion** (or append an audited amendment); every update writes an entry to `audit_logs` (`action='TREATMENT_RECORD_UPDATED'`, `record_id`, `actor_user_id`, `timestamp`).
  - **Patient Visibility:** Patients can view their own appointment's `recommendations` / summary notes in read-only mode on completed visits.
  - **Admin Visibility:** Admins see whether a treatment record exists for operational completeness, but clinical `diagnosis`/`treatment_notes` are restricted to the assigned `DENTIST` (and Patient read-only view).
- **Business Impact:** Balances clinical accuracy with medical record integrity and patient privacy.
- **Technical Impact:** Enforced by field-level serialization and role checks in `TreatmentRecordController` / `TreatmentRecordService`.
- **Decision Owner:** Clinic Owner / Privacy Lead
- **Approval Status:** **Approved**
- **Final Decision:** Assigned `DENTIST` may amend treatment records with mandatory audit logging; clinical details are hidden from emails, sockets, and unauthorized roles.
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-013` — Simultaneous Booking Race Condition Behavior
- **Policy Question:** What happens when two requests attempt to reserve the same or overlapping dentist slot simultaneously?
- **Proposed Default:**
  1. Both requests enter `AppointmentService::createAppointment()` and open an InnoDB transaction.
  2. Each executes `SELECT dentist_id, is_active FROM dentists WHERE dentist_id = :id FOR UPDATE`, serializing concurrent bookings for that specific dentist.
  3. The first transaction to acquire the lock sees zero overlapping rows in `appointments` (`status IN ('PENDING', 'CONFIRMED')`), inserts the appointment + history + notification + email outbox rows, and **commits** (`201 Created`).
  4. The second transaction unblocks, re-runs the overlap `SELECT` inside its transaction, detects the newly committed overlapping row, **rolls back**, and returns `409 Conflict` (`error.code = "SLOT_UNAVAILABLE"`) prompting the React UI to refresh available times.
- **Business Impact:** Guarantees zero double bookings under race conditions.
- **Technical Impact:** Requires InnoDB locking read (`FOR UPDATE`) on `dentists` before querying `appointments`.
- **Decision Owner:** Lead Software Architect
- **Approval Status:** **Approved**
- **Final Decision:** InnoDB transaction with `SELECT ... FOR UPDATE` on target dentist row, interval-overlap check, commit winner (`201`), rollback loser (`409 SLOT_UNAVAILABLE`).
- **Date Decided:** `2026-10-27`

---

### `DEC-POL-014` — Patient & Staff Notification Channels Across Lifecycle Events
- **Policy Question:** How are patients, dentists, and admins informed of requests, approvals, rejections, cancellations, and reminders?
- **Proposed Default:**
  - **Every lifecycle transition** writes a durable `notifications` row (in-app) and an `email_outbox` job inside the MySQL transaction.
  - **Post-commit:** `ProcessEmailOutbox` sends HTML + plain-text emails via `PHPMailer`, and `RealtimePublisher` emits minimal events (`appointment.requested`, `appointment.confirmed`, `appointment.rejected`, `appointment.cancelled`, `notification.created`) to `Socket.IO`.
  - **Privacy Rule:** Emails and Socket.IO events contain only appointment metadata (ID, status, date/time, service name, dentist name, safe rejection/cancellation reason) — **never** clinical diagnoses or treatment notes.
- **Business Impact:** Keeps all actors informed in real time when online and via email/REST history when offline.
- **Technical Impact:** Decouples business transaction success from SMTP/Socket.IO availability.
- **Decision Owner:** Lead Software Architect / Clinic Owner
- **Approval Status:** **Approved**
- **Final Decision:** Durable `notifications` + `email_outbox` persisted in-transaction; PHPMailer and Socket.IO executed post-commit with minimal PII-free payloads.
- **Date Decided:** `2026-10-27`

---

## 3. Required Appointment State Model (Section 13 Specification)

### 3.1 Separation of Concerns: Three Independent State Machines
To prevent operational confusion, the system maintains **three strictly separate statuses**:
1. **Appointment Status (`appointments.status`):** Authoritative business state of the dental visit (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`).
2. **In-App Notification Status (`notifications.read_at`):** User-level read/unread state (`NULL` = Unread, `DATETIME` = Read). Socket.IO delivery is an ephemeral push hint only.
3. **Email Outbox Job Status (`email_outbox.status`):** Asynchronous SMTP delivery state (`PENDING`, `PROCESSING`, `SENT`, `FAILED_RETRYABLE`, `FAILED_PERMANENT`). An email job failure **never** alters `appointments.status`.

### 3.2 State Diagram

```
                     [Patient / Admin submits request]
                                     │
                                     ▼
                              ┌─────────────┐
        ┌────────────────────►│   PENDING   │◄────────────────────┐
        │                     └──────┬──────┘                     │
        │                            │                            │
 [Admin rejects]              [Admin approves]       [Patient / Admin cancels]
        │                            │                            │
        ▼                            ▼                            ▼
 ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
 │  REJECTED   │              │  CONFIRMED  │─────────────►│  CANCELLED  │
 │ (Terminal)  │              └──────┬──────┘  [Policy-    │ (Terminal)  │
 └─────────────┘                     │          allowed    └─────────────┘
                                     │          cancel]
                         [Dentist / Admin marks
                            visit completed]
                                     │
                                     ▼
                              ┌─────────────┐
                              │  COMPLETED  │
                              │ (Terminal)  │
                              └─────────────┘
```

### 3.3 Authoritative State Transition Table

| Current State | Requested Transition | Resulting State | Authorized Actor(s) | Preconditions (Enforced by PHP) | Notification Side Effects (Post-Commit) | Audit Requirements |
|---|---|---|---|---|---|---|
| *(None)* | `create_request` | `PENDING` | `PATIENT` (own), `ADMIN` (on behalf of patient) | Active `patient_id`, `dentist_id`, `service_id`; interval within booking window (`DEC-POL-002`), working hours, and not in `dentist_time_off` (`DEC-POL-003`); zero overlap with `PENDING`/`CONFIRMED` appointments under `FOR UPDATE` lock (`DEC-POL-013`). | **In-App:** Patient + Admin room.<br>**Email:** `appointment_requested` (Patient), `new_request_alert` (Admin).<br>**Socket:** `appointment.requested` -> `role:admin`. | Insert `appointments` row; insert initial `appointment_status_history` (`NULL -> PENDING`, `actor_user_id`). |
| `PENDING` | `approve` | `CONFIRMED` | `ADMIN` only | Appointment is currently `PENDING`; target slot still valid and non-conflicting. | **In-App:** Patient + Assigned Dentist.<br>**Email:** `appointment_confirmed` (Patient).<br>**Socket:** `appointment.confirmed` -> `user:<patient_user_id>`, `dentist:<dentist_id>`. | Insert `appointment_status_history` (`PENDING -> CONFIRMED`, `actor_user_id`, `decided_at`). |
| `PENDING` | `reject` | `REJECTED` *(Terminal; releases slot)* | `ADMIN` only | Appointment is currently `PENDING`; safe rejection reason provided/recommended. | **In-App:** Patient.<br>**Email:** `appointment_rejected` (Patient, includes safe reason).<br>**Socket:** `appointment.rejected` -> `user:<patient_user_id>`. | Insert `appointment_status_history` (`PENDING -> REJECTED`, `actor_user_id`, `reason`). |
| `PENDING` | `cancel` | `CANCELLED` *(Terminal; releases slot)* | `PATIENT` (owner only), `ADMIN` | Appointment is currently `PENDING`; `start_at` has not already been completed. | **In-App:** Admin (if patient cancelled) or Patient (if admin cancelled).<br>**Email:** `appointment_cancelled`.<br>**Socket:** `appointment.cancelled` -> affected parties. | Insert `appointment_status_history` (`PENDING -> CANCELLED`, `actor_user_id`, `reason`). |
| `CONFIRMED` | `cancel` | `CANCELLED` *(Terminal; releases slot)* | `PATIENT` (owner, if `>= 24h` before `start_at` per `DEC-POL-007`), `ADMIN` | Appointment is `CONFIRMED`; if actor is `PATIENT`, current time is prior to cancellation deadline (`DEC-POL-007`); cancellation reason recorded. | **In-App:** Patient, Assigned Dentist, Admin.<br>**Email:** `appointment_cancelled` (Patient & Dentist/Admin).<br>**Socket:** `appointment.cancelled` -> `user:<patient_user_id>`, `dentist:<dentist_id>`, `role:admin`. | Insert `appointment_status_history` (`CONFIRMED -> CANCELLED`, `actor_user_id`, `reason`). |
| `CONFIRMED` | `complete` | `COMPLETED` *(Terminal)* | Assigned `DENTIST` (or `ADMIN` per `DEC-POL-011`) | Appointment is `CONFIRMED`; caller is the assigned `dentist_id` (or authorized `ADMIN`); clinical workflow conditions met. | **In-App:** Patient (`notification.created`).<br>**Socket:** `notification.created` -> `user:<patient_user_id>`. | Insert `appointment_status_history` (`CONFIRMED -> COMPLETED`, `actor_user_id`). |
| `REJECTED`, `CANCELLED`, `COMPLETED` | *Any transition* | **Rejected (`409 Conflict`)** | **None** | Terminal states cannot transition to any other state. Corrections require creating a new appointment or an audited administrative adjustment. | None | Log rejected invalid state transition attempt if anomalous. |

