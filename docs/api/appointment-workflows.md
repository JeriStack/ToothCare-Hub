# Appointment Lifecycle & Clinical Workflows

ToothCare Hub enforces an authoritative server-side appointment state machine backed by MySQL `InnoDB` transactions and row-level locking (`SELECT ... FOR UPDATE`).

---

## 1. Status State Machine

```text
PENDING ──▶ CONFIRMED ──▶ COMPLETED
   │            │
   ├──▶ REJECTED│
   └──▶ CANCELLED ◀──────┘
```

| Status | Description | Valid Next States |
|---|---|---|
| `PENDING` | Requested by patient (or intake), awaiting clinic triage | `CONFIRMED`, `REJECTED`, `CANCELLED` |
| `CONFIRMED` | Approved by `ADMIN` or `RECEPTIONIST` | `COMPLETED`, `CANCELLED` |
| `REJECTED` | Declined by staff with reason | Terminal |
| `CANCELLED` | Cancelled by patient (within cutoff policy) or staff | Terminal |
| `COMPLETED` | Completed by assigned `DENTIST` (or `ADMIN`) after visit | Terminal |

Invalid transitions (e.g., completing a `PENDING` appointment or cancelling a `COMPLETED` appointment) return `409 Conflict` or `422 Unprocessable Entity`.

---

## 2. End-to-End Booking & Clinical Sequence

1. **Discover catalog:** `GET /api/v1/services` and `GET /api/v1/dentists`.
2. **Check real-time availability:** `GET /api/v1/availability?dentist_id={id}&service_id={id}&date=YYYY-MM-DD`.
   - Accounts for clinic operating hours, clinic closures, dentist weekly schedules, approved dentist time-off, service duration, and active (`PENDING`/`CONFIRMED`) bookings.
3. **Create appointment:** `POST /api/v1/appointments` (`201 Created`).
   - Uses `InnoDB` row locking to prevent concurrent double-booking (`409 Conflict`).
   - Atomically writes the appointment, initial status history, in-app notifications, `email_outbox`, and `realtime_outbox` rows.
4. **Triage (Staff):**
   - Confirm: `POST /api/v1/admin/appointments/{id}/confirm` or `POST /api/v1/receptionist/appointments/{id}/confirm`
   - Reject: `POST /api/v1/admin/appointments/{id}/reject` or `POST /api/v1/receptionist/appointments/{id}/reject`
5. **Front-Desk Check-In (Receptionist):**
   - `POST /api/v1/receptionist/appointments/{id}/check-in`
   - Walk-in intake: `POST /api/v1/receptionist/walk-ins`
6. **Clinical Documentation & Completion (Dentist):**
   - Create treatment record: `POST /api/v1/treatment-records` (supports FDI tooth charting and versioned amendments via `PATCH /api/v1/treatment-records/{id}`)
   - Mark completed: `PATCH /api/v1/dentist/appointments/{id}/complete`
7. **Post-Commit Delivery:**
   - Background workers (`backend/bin/email-worker.php` and `backend/bin/realtime-worker.php`) deliver SMTP emails and Socket.IO broadcasts outside the database transaction so external delivery issues never roll back committed appointments.
