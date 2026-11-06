# Phase 10: Appointment Booking Workflow

## 1. Overview
The ToothCare Hub appointment booking workflow guides patients through an intuitive 4-step wizard interface while enforcing strict transactional validation on the backend to eliminate race conditions, double-booking, and invalid status entries.

---

## 2. Step-by-Step Patient Booking Experience

```
[ Step 1: Service Selection ]
          │ (Active procedures, pricing, duration)
          ▼
[ Step 2: Attending Dentist Selection ]
          │ (Specialization, assigned operatory chair)
          ▼
[ Step 3: Date & Live Time Slot Picker ]
          │ (Driven by Phase 9 AvailabilityService)
          ▼
[ Step 4: Review, Chief Complaint & Policy Agreement ]
          │ (Summary snapshot, notes, terms)
          ▼
[ Submission & Transactional Booking ]
          │ (Pessimistic lock, re-verification, snapshot insertion)
          ▼
[ Success Confirmation Screen ]
  (Ref #APP-XXXX, status: PENDING clinic review)
```

### Step 1: Dental Service Selection
- Lists active dental procedures (`is_active = 1`).
- Displays category, description, official clinic price, and standard duration.
- Client cannot alter prices or durations.

### Step 2: Attending Dentist Selection
- Lists active practitioners (`is_active = 1`).
- Displays practitioner specialization, bio, and assigned default operatory room.

### Step 3: Live Date & Time Slot Picker
- Defaults date selection to tomorrow.
- Embeds `<AvailabilitySlotPicker />` which calls `GET /api/v1/availability`.
- Calculates valid start times taking into account clinic operating hours, dentist recurring shifts, existing bookings (`PENDING`, `CONFIRMED`), approved doctor leaves, and facility closures.
- Slots incorporate turnaround buffer minutes between patients.

### Step 4: Review & Chief Complaint Entry
- Summarizes the selection: service, practitioner, chair, scheduled interval, and fee snapshot.
- Patient enters an optional chief complaint / symptom description (up to 500 characters).
- Patient must agree to clinic scheduling terms before submission.

---

## 3. Server-Side Processing Pipeline

When `POST /api/v1/appointments` is invoked:
1. **Authentication Verification:** `AuthenticationMiddleware` ensures caller has an active session cookie.
2. **Patient Profile Resolution:** The system retrieves the patient record tied to `$_SESSION['user_id']`. If missing, returns `403 FORBIDDEN`.
3. **Payload Validation:** `AppointmentValidator::validateBooking()` validates format of `dentist_id`, `service_id`, `start_at` (`YYYY-MM-DD HH:MM:SS`), and `chief_complaint`.
4. **Database Transaction Initiation:** A MySQL InnoDB transaction begins (`$pdo->beginTransaction()`).
5. **Dentist Row Locking:** The repository executes `SELECT id FROM dentists WHERE id = :id FOR UPDATE`. This serializes all concurrent booking attempts for this specific doctor until commit or rollback.
6. **Entity Existence & Active Checks:** Checks that both dentist and service exist and are active.
7. **End Time & Buffer Calculation:**
   - Duration is taken from `services.duration_minutes`.
   - End time is computed: `end_at = start_at + duration_minutes`.
   - Required buffer is retrieved from clinic settings or service configuration.
8. **Live Slot Availability Re-verification:**
   - Calls `AvailabilityService::isSlotAvailable($dentistId, $startAt, $endAt, $bufferMinutes)`.
   - If slot is taken, throws `HttpException::conflict('The selected appointment slot is no longer available.', 'SLOT_UNAVAILABLE')`, triggering immediate transaction rollback.
9. **Record Creation with Snapshots:**
   - Inserts record into `appointments` with initial status `PENDING`.
   - Snapshots current `price_snapshot = service.price` and `duration_snapshot = service.duration_minutes`.
10. **Immutable Status History Log:**
    - Inserts entry into `appointment_status_history`: `from_status = null`, `to_status = 'PENDING'`, `changed_by_user_id = patient.user_id`, `reason = 'Initial booking request submitted by patient'`.
11. **Transaction Commit:** `$pdo->commit()` releases the lock.
12. **Notification Dispatch:** An automated notification email is queued informing the patient of receipt.
