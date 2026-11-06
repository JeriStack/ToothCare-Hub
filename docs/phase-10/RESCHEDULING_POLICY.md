# Phase 10: Rescheduling Policy and Architecture

## 1. Overview
When a patient or staff member reschedules an appointment, ToothCare Hub adopts **Option A: Atomic Cancel-and-Create**. Rather than modifying the time coordinates of an existing appointment in-place, the system cleanly cancels the original record with a recorded reason, creates a brand-new appointment, and links them via the `rescheduled_from_id` foreign key.

---

## 2. Why Option A (Cancel-and-Create)?

Modifying appointments in-place introduces severe clinical and legal auditing hazards:
1. **Audit Integrity:** In clinical practice, past scheduled appointments are legal records. Mutating `start_at` on an existing appointment destroys the chronological record of when the patient was originally scheduled to visit.
2. **Billing & Snapshot Integrity:** If service pricing or doctor duration changed between the initial booking and the reschedule date, in-place updates create ambiguity over which price and duration snapshots apply.
3. **Status History Clarity:** Having an appointment jump backward and forward in time within one record confuses reporting pipelines and patient portal views.
4. **Relational Traceability:** Option A preserves an immutable link between the old visit and the new visit through `rescheduled_from_id`.

---

## 3. Rescheduling Lifecycle Workflow

```
[ Active Appointment #101 ] (Status: PENDING or CONFIRMED)
            │
            ▼ Patient or Admin initiates Reschedule
[ MySQL Transaction Begins ]
            │
            ├─► 1. Pessimistic lock on attending dentist
            │
            ├─► 2. Cancel Original Appointment #101:
            │      • Status updated to `CANCELLED`
            │      • Cancellation reason: 'Rescheduled to new slot on YYYY-MM-DD HH:MM'
            │      • Status history recorded: PENDING/CONFIRMED -> CANCELLED
            │
            ├─► 3. Validate and re-verify new candidate slot availability
            │
            ├─► 4. Insert New Appointment #102:
            │      • Status: `PENDING`
            │      • Scheduled interval: new_start_at to new_end_at
            │      • Price snapshot & duration snapshot locked from current service
            │      • `rescheduled_from_id` = 101
            │      • Status history recorded: null -> PENDING (reason: 'Rescheduled from #101')
            │
            └─► 5. COMMIT Transaction
                        │
                        ▼
    New Appointment #102 returned to client
```

---

## 4. Business and Validation Rules

1. **Permitted Statuses for Rescheduling:** Only appointments in `PENDING` or `CONFIRMED` states may be rescheduled. Terminal appointments (`CANCELLED`, `REJECTED`, `COMPLETED`) cannot be rescheduled.
2. **Actor Authorization:**
   - **Patients:** Can only reschedule their own appointments. The authenticated user's patient ID must match the appointment's `patient_id`.
   - **Administrators:** Can reschedule appointments across all patients.
3. **Slot Availability:** The new slot must be strictly verified against clinic operating hours, doctor shifts, leaves, closures, and other appointments using `AvailabilityService`.
4. **Conflict Handling:** If the target slot is seized by another user concurrently, the transaction rolls back completely (retaining original appointment #101 in its original state) and returns `HTTP 409 Conflict`. The UI displays a warning prompting the patient to choose another time slot.
