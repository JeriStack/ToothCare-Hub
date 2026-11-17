# Phase 10: Appointment Lifecycle and Finite State Machine

## 1. Overview
ToothCare Hub models appointment lifecycles through a finite state machine with strict transition guards. Every status change is transactional, fully audited, and permanently preserved in the `appointment_status_history` table.

---

## 2. Status Definitions

| Status | Category | Meaning | Slot Behavior |
| :--- | :--- | :--- | :--- |
| `PENDING` | Active | Initial request submitted by patient; awaiting clinic review and chair assignment. | **Blocks slot** |
| `CONFIRMED` | Active | Approved by clinic administration; confirmed on doctor calendar. | **Blocks slot** |
| `REJECTED` | Terminal | Request declined by clinic (e.g., doctor unavailable, maintenance). | **Releases slot** |
| `CANCELLED` | Terminal | Cancelled by patient or administrator before or during appointment day. | **Releases slot** |
| `COMPLETED` | Terminal | Clinical visit concluded; ready for treatment record archival and invoicing. | **Releases future slot** |

---

## 3. Allowed Transition Matrix

The `AppointmentValidator::ALLOWED_TRANSITIONS` mapping strictly dictates legal status progressions:

```
                  ┌───────────────┐
                  │    PENDING    │
                  └───────┬───────┘
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
      ┌───────────┐ ┌───────────┐ ┌───────────┐
      │ CONFIRMED │ │ REJECTED  │ │ CANCELLED │
      └─────┬─────┘ └───────────┘ └───────────┘
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌───────────┐ ┌───────────┐
│ COMPLETED │ │ CANCELLED │
└───────────┘ └───────────┘
```

| Current Status | Permitted New Statuses | Disallowed Statuses | Authorized Actors |
| :--- | :--- | :--- | :--- |
| **`PENDING`** | `CONFIRMED`, `REJECTED`, `CANCELLED` | `COMPLETED` | Patient (`CANCELLED`), Admin/Staff (All) |
| **`CONFIRMED`** | `COMPLETED`, `CANCELLED` | `PENDING`, `REJECTED` | Patient (`CANCELLED`), Admin/Staff (All) |
| **`REJECTED`** | *None (Terminal)* | Any | None |
| **`CANCELLED`** | *None (Terminal)* | Any | None |
| **`COMPLETED`** | *None (Terminal)* | Any | None |

> [!IMPORTANT]
> Any attempt to mutate a terminal status (`REJECTED`, `CANCELLED`, `COMPLETED`) or jump between disallowed states (e.g. `PENDING` straight to `COMPLETED`, or reviving `CANCELLED` to `CONFIRMED`) throws an unprocessable entity error (`HTTP 422: INVALID_TRANSITION`).

---

## 4. Immutable Status History Logging

Every valid status transition executes `AppointmentRepository::recordStatusHistory()` within the same database transaction:

```sql
INSERT INTO appointment_status_history (
    appointment_id,
    from_status,
    to_status,
    changed_by_user_id,
    reason,
    created_at
) VALUES (
    :appointment_id,
    :from_status,
    :to_status,
    :changed_by_user_id,
    :reason,
    NOW()
);
```

### Transition Audit Properties:
- **`appointment_id`:** Target appointment reference.
- **`from_status`:** Previous status value (`NULL` for initial booking).
- **`to_status`:** Target status being assumed.
- **`changed_by_user_id`:** Authenticated user who performed or triggered the change.
- **`reason`:** Mandatory for rejections; optional or defaulted for confirmations, cancellations, and completions.
- **`created_at`:** Precise Asia/Manila timestamp of the transition.

Status history entries are append-only. There are no `UPDATE` or `DELETE` endpoints for status history rows.
