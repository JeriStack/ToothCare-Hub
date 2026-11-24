# Appointment Triage, Dentist Availability Validation & Scheduling Conflict Detection

## 1. Centralized Availability Architecture

All appointment availability calculations and conflict checks run through a single authoritative backend service:

- **Service**: `backend/src/Services/AvailabilityService.php`
- **Primary Methods**:
  - `validateSlot(...)` — Authoritative validation engine returning a structured verdict (`available`, `availability_status`, `reason_code`, `message`, `suggested_rejection_reason`, `operatory_chair`, `conflict_context`).
  - `isSlotAvailable(...)` — Boolean wrapper delegating directly to `validateSlot()`.
  - `getAvailability(...)` — Computes bookable slots across a date range, returns specific per-day unavailability reason codes/messages, and attaches validated `alternatives` (`next_available_dates`, `alternative_dentists`) when a single-day lookup returns zero slots.
  - `findAlternatives(...)` — Scans upcoming dates (next 14 days) and other active practitioners through the exact same validation engine.
  - `evaluateAppointmentsBatch(...)` — Evaluates a batch of pending appointments using preloaded static clinic reference data and 4 batched date-span queries (closures, time-off, schedule exceptions, blocking appointments bucketed by `(dentist_id, date)` and `(operatory_chair, date)` for O(1) per-day overlap checks).
  - `countPendingConflicts(...)` — Streams **all** `PENDING` appointments across the database via keyset-paginated chunks (`status = 'PENDING' AND id > :after_id ORDER BY id ASC LIMIT :limit`, default chunk size `500`), evaluating every row against the exact same authoritative approval rules with bounded memory and no 200-record cap.

Both **patient booking** (`AppointmentService::bookAppointment`, `rescheduleAppointment`), **front-desk booking** (`ReceptionistService::createAppointment`), **triage listing & pre-check** (`AppointmentService::listAdminAppointments`, `validateAppointmentForApproval`), and **receptionist/admin approval** (`AppointmentService::confirmAppointment`) execute against `AvailabilityService`.

## 2. Availability & Conflict Rules

The validation engine evaluates constraints in the following order (clinic timezone: `Asia/Manila`):

1. **Dentist Active Status (`DENTIST_INACTIVE`)**: Both `dentists.is_active` and `users.is_active` must equal `1`.
2. **Service Active Status (`SERVICE_INACTIVE`)**: `services.is_active` must equal `1`.
3. **Date Bounds & Advance Notice (`PAST_DATE`, `BOOKING_HORIZON_EXCEEDED`, `ADVANCE_NOTICE_REQUIRED`)**: Enforced for patient bookings and patient reschedules (min advance notice: 120 minutes, max horizon: 90 days). Staff-initiated reschedules bypass patient cutoff restrictions while still enforcing all schedule/conflict rules.
4. **Clinic Operating Hours (`CLINIC_CLOSED`)**: Evaluated against `clinic_operating_hours` for the weekday (`1=Mon`..`7=Sun`).
5. **Clinic Holiday & Maintenance Closures (`UNAVAILABLE_PERIOD`)**: Evaluated against `clinic_closures` using half-open interval overlap.
6. **Dentist Approved Leave / Time Off (`APPROVED_LEAVE`)**: Evaluated against `dentist_time_off`.
7. **Dentist Working & Duty Schedule (`NOT_WORKING_DAY`, `NOT_ON_DUTY`, `OUTSIDE_WORKING_HOURS`, `SERVICE_DURATION_CONFLICT`)**:
   - Uses `dentist_schedules` (recurring shifts per weekday, which is ToothCare Hub's authoritative duty schedule) combined with optional date-specific overrides in `dentist_schedule_exceptions`.
   - Distinguishes between non-working days (`NOT_WORKING_DAY`), split-shift breaks (`NOT_ON_DUTY`), outside shift hours (`OUTSIDE_WORKING_HOURS`), and procedures whose `duration_minutes + 10m turnaround buffer` extend beyond shift/clinic closing (`SERVICE_DURATION_CONFLICT`).
8. **Overlapping Dentist Appointments (`APPOINTMENT_CONFLICT`)**:
   - Statuses that reserve time: `PENDING` and `CONFIRMED`.
   - Statuses that do not block: `COMPLETED`, `REJECTED`, `CANCELLED`.
   - Half-open overlap check: adjacent back-to-back bookings (e.g., `10:00–10:30` followed by `10:30–11:00`) are permitted; overlapping windows are rejected.
9. **Operatory Room Conflicts (`ROOM_CONFLICT`)**:
   - Validates that the resolved `operatory_chair` is not occupied by another practitioner's overlapping `PENDING` or `CONFIRMED` appointment.

## 3. Unbounded Scheduling Conflict Counter & Indexing Strategy

### How `meta.summary.scheduling_conflicts` Is Calculated
Previously, `listAdminAppointments()` loaded at most 200 pending rows and evaluated them one-by-one (N+1 queries + silent undercounting beyond 200 pending appointments).

The current implementation eliminates both bottlenecks without simplifying a single conflict rule:
1. **One-time reference cache** (`loadClinicReferenceCache()`): Loads `clinic_operating_hours`, `dentists` (+ `users.is_active`), `services`, and `dentist_schedules` once per summary sweep.
2. **Keyset chunk streaming** (`AppointmentRepository::findPendingChunkAfterId()`): Iterates through **all** `PENDING` appointments in chunks of 500 ordered by `id ASC` (`WHERE status = 'PENDING' AND id > :after_id ORDER BY id ASC LIMIT :limit`), keeping PHP peak memory flat (~4 MB) regardless of total pending queue size.
3. **Set-based chunk queries + day-bucketed overlap lookup**: For each chunk, executes only 4 batched SQL queries (`clinic_closures`, `dentist_time_off`, `dentist_schedule_exceptions`, and `AppointmentRepository::findBlockingForBatch()`), bucketing blocking appointments by `(dentist_id, Y-m-d)` and `(operatory_chair, Y-m-d)` for O(1) same-day lookup.
4. **Pagination independence**: The count covers the entire pending queue across all pages, not just the current page or first 200 records.

### Supporting Database Indexes (Migration `034`)
- **Migration**: `database/migrations/034_add_scheduling_conflict_indexes.sql`
- **Rollback**: `database/migrations/rollback/034_add_scheduling_conflict_indexes.down.sql`
- **Indexes added to `appointments`**:
  - `idx_appointments_status_id (status, id)` — Enables zero-filesort keyset streaming over `WHERE status = 'PENDING' AND id > :after_id ORDER BY id ASC LIMIT :limit` as historical non-pending rows accumulate.
  - `idx_appointments_room_overlap (operatory_chair, status, start_at, end_at)` — Supports set-based operatory room overlap scans in `findBlockingForBatch()` alongside existing `idx_appointments_dentist_time (dentist_id, status, start_at, end_at)` and `idx_closures_interval (start_at, end_at)`.

### Benchmark Evidence (Live MySQL 8.0)
Measured against live `toothcare-mysql` with **304 pending appointments** (4 existing + 240 valid non-overlapping synthetic slots + 60 conflicting synthetic slots placed beyond ID #240):
- **Accuracy**: `60 / 60` conflicts counted identically across both `chunkSize = 500` and `chunkSize = 100` (proving complete removal of the 200-row cap).
- **Latency (`chunkSize = 500`, 5 runs)**: min `22.99 ms`, **median `25.04 ms`**, max `34.89 ms`.
- **Peak PHP Memory**: `4.00 MB`.

## 4. Concurrency Protection, Approval & Staff Rescheduling Workflow

### Approval Revalidation & Lock Ordering
- **Consistent Lock Ordering**: All write transactions (`bookAppointment`, `confirmAppointment`, `rescheduleAppointment`, `ReceptionistService::createAppointment`) acquire a pessimistic row lock on the target dentist (`SELECT ... FROM dentists WHERE id = ? FOR UPDATE`) before locking or mutating `appointments` rows (`SELECT ... FROM appointments WHERE id = ? FOR UPDATE`).
- This prevents concurrent double-booking, simultaneous approval races, and cross-transaction deadlocks while allowing independent dentists to process bookings concurrently.
- When `confirmAppointment()` detects a conflict, the transaction rolls back cleanly, the appointment remains `PENDING`, and the API returns `409 Conflict` with structured `details` (`reason_code`, `availability_status`, `suggested_rejection_reason`, `conflict_context`, `appointment_remains_pending: true`).

### Rescheduling & Dentist Reassignment from the Conflict Warning Dialog
- **Backend Workflow Reused**: `POST /api/v1/appointments/{id}/reschedule` (`AppointmentService::rescheduleAppointment()`) handles atomic cancel-and-relink (`rescheduled_from_id`), optional `dentist_id` / `service_id` reassignment, full `AvailabilityService::validateSlot()` revalidation, authoritative `operatory_chair` assignment, status history metadata (`rescheduled_by_role`, `previous_dentist_id`, `new_dentist_id`), audit logging, email outbox, and Socket.IO realtime events.
- **Server-Side Authorization**: Restricted strictly to `PATIENT` (own appointments only, subject to clinic cancellation cutoff), `ADMIN`, and `RECEPTIONIST` (verified against DRBAC `appointments.manage`). Non-authorized roles such as `DENTIST` receive `403 Forbidden`.
- **UI Entry Point**: In `AdminAppointmentsPage.jsx`, when a receptionist or administrator inspects a blocked pending appointment in the Conflict Warning dialog, a **Reschedule / Reassign** action opens a compact modal reusing `<AvailabilitySlotPicker />`. Dentist reassignment is always explicit (never silent), displays a visible confirmation banner when the dentist changes, and requires selecting a live backend-validated slot before submitting.

## 5. Conflict-to-Rejection Reason Mapping

| Conflict Reason Code | Prefilled Patient-Facing Rejection Reason |
|---|---|
| `NOT_WORKING_DAY` | The selected dentist is not scheduled to work on your requested appointment date. Please select another date. |
| `NOT_ON_DUTY` | The selected dentist is not on duty during your requested appointment time. Please choose another available time. |
| `OUTSIDE_WORKING_HOURS` | The requested appointment time is outside the dentist's working schedule. Please select an available time. |
| `SERVICE_DURATION_CONFLICT` | The requested appointment duration extends beyond the dentist's available working hours. Please select an earlier or alternative time. |
| `APPROVED_LEAVE` | The selected dentist is unavailable on your requested date. Please choose another date or dentist. |
| `CLINIC_CLOSED` / `UNAVAILABLE_PERIOD` | The clinic or dentist is unavailable on your requested date and time. Please select another available date. |
| `APPOINTMENT_CONFLICT` | The selected dentist has another appointment during your requested time. Please select another available time. |
| `ROOM_CONFLICT` | The requested appointment slot is unavailable because the required clinic room is occupied. Please select another time. |
| `DENTIST_INACTIVE` | The selected dentist is currently unavailable for new appointments. Please choose another available dentist. |
| `SERVICE_INACTIVE` | The requested dental service is currently unavailable for booking. Please choose another service or contact the clinic. |

- Receptionists review and may edit the prefilled reason (and optionally append an additional note) before confirming rejection.
- The internal `conflict_reason_code` is recorded in `appointment_status_history.metadata` and `audit_logs`, while only the sanitized, reviewed patient-facing reason is stored in `appointments.cancellation_reason`, persisted into the patient's in-app notification, and queued into `email_outbox`.
- Real-time Socket.IO events are enqueued in `realtime_outbox` inside the transaction and dispatched post-commit via `dispatchPendingBestEffort()`.

## 6. API Endpoints

- `GET /api/v1/availability` — Returns daily slots plus per-day `dentist_on_duty`, `reason_code`, `reason_message`, and validated `alternatives` when a single-day query has zero slots.
- `GET /api/v1/availability/validate` — Validates a specific `(dentist_id, service_id, start_at)` slot and returns structured availability status and alternatives.
- `GET /api/v1/admin/appointments` — Supports reference search (`#ID` / `TC-000001`), inclusive `start_date`/`end_date` bounds (`00:00:00` to `23:59:59` Asia/Manila), attaches live `availability_check` to `PENDING` rows via `evaluateAppointmentsBatch()`, and returns exact unbounded `meta.summary.scheduling_conflicts`.
- `GET /api/v1/admin/appointments/{id}/availability` — Revalidates a pending appointment prior to approval (protected by `appointments.view`).
- `PATCH /api/v1/admin/appointments/{id}/confirm` — Locks dentist + appointment rows and enforces full `AvailabilityService::validateSlot()` before confirming.
- `PATCH /api/v1/admin/appointments/{id}/reject` — Accepts `reason` and optional `conflict_reason_code`, persists history/audit/notifications/outbox atomically.
- `POST /api/v1/appointments/{id}/reschedule` — Atomically cancels and relinks an appointment to a newly validated slot (and optional reassigned dentist), enforcing role authorization (`PATIENT` owner, `ADMIN`, or `RECEPTIONIST` with `appointments.manage`).

## 7. Automated & Live Docker Verification Procedures

### Automated Regression Suites
```bash
# Apply pending MySQL schema migrations (includes 034_add_scheduling_conflict_indexes.sql)
php database/migrate.php

# Backend PHPUnit unit & integration suites + OpenAPI validation
composer --working-dir=backend test:unit
composer --working-dir=backend test:integration
composer --working-dir=backend openapi:validate

# Frontend Vitest suite + Vite production build
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

### Live Docker Integration Verification Checklist
Verify against the running Docker services (`toothcare-mysql`, `toothcare-php-fpm`, `toothcare-nginx`, `toothcare-realtime`, `toothcare-realtime-worker`, `toothcare-email-worker`, `toothcare-mailpit`):
- **Workflow A (Successful Approval)**: `POST /api/v1/appointments` → Socket.IO `appointment.requested` + persisted receptionist notification → `GET /api/v1/admin/appointments/{id}/availability` (`available: true`) → `PATCH /api/v1/admin/appointments/{id}/confirm` (`200 CONFIRMED`) → Socket.IO `appointment.confirmed` + persisted patient notification + Mailpit capture (`Your appointment is confirmed`).
- **Workflow B (Scheduling Conflict)**: Book valid slot → insert `dentist_time_off` covering slot → `GET /api/v1/admin/appointments/{id}/availability` (`APPROVED_LEAVE` + prefilled reason) → `PATCH /api/v1/admin/appointments/{id}/confirm` returns `409 Conflict` with `appointment_remains_pending: true` and DB status remains `PENDING`.
- **Workflow C (Conflict Rejection & Mailpit Capture)**: `PATCH /api/v1/admin/appointments/{id}/reject` with edited reason & `conflict_reason_code` → `200 REJECTED`, `appointment_status_history.metadata` retains `conflict_reason_code`, patient receives Socket.IO `appointment.rejected` + persisted notification containing the reason, and Mailpit captures `Your appointment request could not be accepted` containing the reviewed clinic note.
- **Workflow D (WebSocket Reconnection Recovery)**: Record `latest_id` via `GET /api/v1/notifications/sync` → disconnect Socket.IO → trigger appointment event → reconnect with a fresh single-use ticket (`POST /api/v1/realtime/ticket`) → call `GET /api/v1/notifications/sync?after_id=<cursor>` to recover missed notifications without data loss.
- **Note on PHP-FPM OPcache**: In Docker (`opcache.validate_timestamps = Off`), run `docker restart toothcare-php-fpm` after backend PHP code edits before testing live HTTP routes.

## 8. Remaining Technical Limitations

- **`dentist_schedules` as Duty Schedule**: ToothCare Hub uses `dentist_schedules` (recurring weekday shifts) plus optional date-specific rows in `dentist_schedule_exceptions` rather than a separate daily duty-roster table.
- **Large Queue Linear Scaling**: `countPendingConflicts()` now evaluates every `PENDING` appointment in keyset chunks (~25 ms for 304 pending rows on local MySQL 8.0). If a future multi-branch deployment routinely holds tens of thousands of simultaneous `PENDING` appointments, caching or maintaining a materialized conflict-status column invalidated on schedule/leave/booking mutations would further bound `GET /api/v1/admin/appointments` latency.
- **Rescheduled Appointment Approval Step**: Because `POST /api/v1/appointments/{id}/reschedule` preserves the standard appointment lifecycle, newly linked rescheduled appointments start in `PENDING` status and require explicit staff confirmation if immediate approval is desired.
