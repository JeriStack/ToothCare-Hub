# Appointment Triage, Dentist Availability Validation & Scheduling Conflict Detection

## 1. Centralized Availability Architecture

All appointment availability calculations and conflict checks run through a single authoritative backend service:

- **Service**: `backend/src/Services/AvailabilityService.php`
- **Primary Methods**:
  - `validateSlot(...)` — Authoritative validation engine returning a structured verdict (`available`, `availability_status`, `reason_code`, `message`, `suggested_rejection_reason`, `operatory_chair`, `conflict_context`).
  - `isSlotAvailable(...)` — Boolean wrapper delegating directly to `validateSlot()`.
  - `getAvailability(...)` — Computes bookable slots across a date range, returns specific per-day unavailability reason codes/messages, and attaches validated `alternatives` (`next_available_dates`, `alternative_dentists`) when a single-day lookup returns zero slots.
  - `findAlternatives(...)` — Scans upcoming dates (next 14 days) and other active practitioners through the exact same validation engine.

Both **patient booking** (`AppointmentService::bookAppointment`, `rescheduleAppointment`), **front-desk booking** (`ReceptionistService::createAppointment`), **triage listing & pre-check** (`AppointmentService::listAdminAppointments`, `validateAppointmentForApproval`), and **receptionist/admin approval** (`AppointmentService::confirmAppointment`) execute against `AvailabilityService::validateSlot()`.

## 2. Availability & Conflict Rules

The validation engine evaluates constraints in the following order (clinic timezone: `Asia/Manila`):

1. **Dentist Active Status (`DENTIST_INACTIVE`)**: Both `dentists.is_active` and `users.is_active` must equal `1`.
2. **Service Active Status (`SERVICE_INACTIVE`)**: `services.is_active` must equal `1`.
3. **Date Bounds & Advance Notice (`PAST_DATE`, `BOOKING_HORIZON_EXCEEDED`, `ADVANCE_NOTICE_REQUIRED`)**: Enforced for new bookings and reschedules (min advance notice: 120 minutes, max horizon: 90 days).
4. **Clinic Operating Hours (`CLINIC_CLOSED`)**: Evaluated against `clinic_operating_hours` for the weekday (`1=Mon`..`7=Sun`).
5. **Clinic Holiday & Maintenance Closures (`UNAVAILABLE_PERIOD`)**: Evaluated against `clinic_closures` using half-open interval overlap.
6. **Dentist Approved Leave / Time Off (`APPROVED_LEAVE`)**: Evaluated against `dentist_time_off`.
7. **Dentist Working & Duty Schedule (`NOT_WORKING_DAY`, `NOT_ON_DUTY`, `OUTSIDE_WORKING_HOURS`, `SERVICE_DURATION_CONFLICT`)**:
   - Uses `dentist_schedules` (recurring shifts per weekday, which is ToothCare Hub's authoritative duty schedule) combined with optional date-specific overrides in `dentist_schedule_exceptions`.
   - Distinguishes between non-working days (`NOT_WORKING_DAY`), split-shift breaks (`NOT_ON_DUTY`), outside shift hours (`OUTSIDE_WORKING_HOURS`), and procedures whose `duration_minutes + 10m turnaround buffer` extend beyond shift/clinic closing (`SERVICE_DURATION_CONFLICT`).
8. **Overlapping Dentist Appointments (`APPOINTMENT_CONFLICT`)**:
   - Statuses that reserve time: `PENDING` and `CONFIRMED`.
   - Statuses that do not block: `COMPLETED`, `REJECTED`, `CANCELLED`.
   - Half-open overlap check: `requested_start < existing_end AND (requested_end + buffer) > existing_start`.
   - Adjacent non-overlapping intervals (e.g., `09:00–10:00` followed by `10:00–10:30`) are permitted.
9. **Operatory Room Conflicts (`ROOM_CONFLICT`)**:
   - Validates that the resolved `operatory_chair` is not occupied by another practitioner's overlapping `PENDING` or `CONFIRMED` appointment.

## 3. Concurrency Protection & Approval Workflow

- **Consistent Lock Ordering**: All write transactions (`bookAppointment`, `confirmAppointment`, `rescheduleAppointment`, `ReceptionistService::createAppointment`) acquire a pessimistic row lock on the target dentist (`SELECT ... FROM dentists WHERE id = ? FOR UPDATE`) before locking or mutating `appointments` rows (`SELECT ... FROM appointments WHERE id = ? FOR UPDATE`).
- This prevents concurrent double-booking, simultaneous approval races, and cross-transaction deadlocks while allowing independent dentists to process bookings concurrently.
- When `confirmAppointment()` detects a conflict, the transaction rolls back cleanly, the appointment remains `PENDING`, and the API returns `409 Conflict` with structured `details` (`reason_code`, `availability_status`, `suggested_rejection_reason`, `conflict_context`, `appointment_remains_pending: true`).

## 4. Conflict-to-Rejection Reason Mapping

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

## 5. API Endpoints

- `GET /api/v1/availability` — Returns daily slots plus per-day `dentist_on_duty`, `reason_code`, `reason_message`, and validated `alternatives` when a single-day query has zero slots.
- `GET /api/v1/availability/validate` — Validates a specific `(dentist_id, service_id, start_at)` slot and returns structured availability status and alternatives.
- `GET /api/v1/admin/appointments` — Supports reference search (`#ID` / `TC-000001`), inclusive `start_date`/`end_date` bounds (`00:00:00` to `23:59:59` Asia/Manila), attaches live `availability_check` to `PENDING` rows, and returns real operational `meta.summary` counts.
- `GET /api/v1/admin/appointments/{id}/availability` — Revalidates a pending appointment prior to approval (protected by `appointments.view`).
- `PATCH /api/v1/admin/appointments/{id}/confirm` — Locks dentist + appointment rows and enforces full `AvailabilityService::validateSlot()` before confirming.
- `PATCH /api/v1/admin/appointments/{id}/reject` — Accepts `reason` and optional `conflict_reason_code`, persists history/audit/notifications/outbox atomically.

## 6. Database Schema Notes

No destructive or redundant migrations were required. The existing schema already supports:
- `dentist_schedules`, `dentist_time_off`, `dentist_schedule_exceptions`
- `clinic_operating_hours`, `clinic_closures`
- `appointments` (`start_at`, `end_at`, `duration_snapshot`, `operatory_chair`, `cancellation_reason`)
- `appointment_status_history` (`old_status`, `new_status`, `reason`, `metadata`)
- `notifications`, `email_outbox`, `realtime_outbox`, `audit_logs`

## 7. Testing Instructions

```bash
# Backend PHPUnit test suite (availability, approval revalidation, concurrency, notifications)
composer --working-dir=backend test

# OpenAPI spec regeneration & drift validation
composer --working-dir=backend openapi:generate
composer --working-dir=backend openapi:validate

# Frontend unit & component tests + production build
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

## 8. Known Limitations

- Pending appointment conflict counting in `meta.summary.scheduling_conflicts` evaluates up to the 200 earliest pending appointments per request to keep triage listing latency bounded.
- Receptionist conflict warning currently supports **Reject Appointment** and **Recheck Availability**; inline staff rescheduling/reassignment from the conflict modal is deferred until a dedicated admin reschedule workflow is approved.
- `dentist_schedules` serves as the authoritative duty schedule (no separate duty roster table exists in the approved schema); optional date-specific overrides are honored via `dentist_schedule_exceptions` when populated.
