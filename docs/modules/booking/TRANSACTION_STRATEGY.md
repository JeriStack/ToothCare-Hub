# Phase 10: Database Transaction Strategy and Concurrency Safety

## 1. Overview
In clinical scheduling systems, race conditions can cause multiple patients to simultaneously book or confirm overlapping consultation slots with the same dentist or in the same operatory chair. ToothCare Hub enforces a deterministic transaction strategy that leverages MySQL InnoDB row-level locking to guarantee serializability and eliminate double booking.

---

## 2. Pessimistic Row Locking Architecture

### The Race Condition Problem
Consider two patients $P_1$ and $P_2$ viewing Dr. Maria Santos's schedule simultaneously:
1. $P_1$ queries availability: `09:00 - 09:45` is available.
2. $P_2$ queries availability: `09:00 - 09:45` is available.
3. Both submit booking requests at identical timestamps $T_0$.
4. Without provider locking, both requests check for overlapping appointments concurrently, find zero conflicting rows, and execute an `INSERT`. Dr. Santos is now double-booked.

### The Locking Solution
To prevent this, ToothCare Hub serializes booking and confirmation operations on a per-dentist basis using pessimistic row locking:

```sql
SELECT id FROM dentists WHERE id = :dentist_id FOR UPDATE;
```

```
Request 1 (Patient A)                         Request 2 (Patient B)
        │                                              │
        ▼                                              ▼
BEGIN TRANSACTION                              BEGIN TRANSACTION
        │                                              │
SELECT ... FOR UPDATE (Dentist 1)              SELECT ... FOR UPDATE (Dentist 1)
[Acquires Exclusive Row Lock]                  [Blocked, waits for Lock Release]
        │                                              ┆
Check Availability via AvailabilityService             ┆
        │                                              ┆
Insert into `appointments`                             ┆
        │                                              ┆
Insert into `appointment_status_history`               ┆
        │                                              ┆
COMMIT [Releases Exclusive Row Lock]                   ┆
        ▼                                              ▼
Patient A succeeds (201 Created)               [Unblocks, Acquires Row Lock]
                                                       │
                                               Check Availability via AvailabilityService
                                                       │
                                               Slot now overlaps with Patient A!
                                                       │
                                               ROLLBACK [Releases Exclusive Row Lock]
                                                       ▼
                                               Patient B receives 409 Conflict
```

---

## 3. Database Driver Adaptation

While production environments run MySQL 8.0 InnoDB (which fully supports `SELECT ... FOR UPDATE`), in-memory SQLite used for unit and automated integration testing rejects `FOR UPDATE` as a syntax error.

`AppointmentRepository` implements driver detection:

```php
$isSqlite = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
$sql = "SELECT id FROM dentists WHERE id = :id" . ($isSqlite ? '' : ' FOR UPDATE');
```

This guarantees:
- Full pessimistic row serialization in production on MySQL.
- Smooth automated test execution in CI/CD environments.

---

## 4. Transaction Boundaries & Atomicity

Every multi-row write is strictly wrapped in transaction boundaries:

```php
$this->db->beginTransaction();
try {
    // 1. Pessimistic lock on dentist
    $this->appointmentRepo->lockDentist($dentistId);

    // 2. Full re-verification of slot availability
    if (!$this->availabilityService->isSlotAvailable($dentistId, $startAt, $endAt, $bufferMinutes)) {
        throw HttpException::conflict('The selected appointment slot is no longer available.', 'SLOT_UNAVAILABLE');
    }

    // 3. Insert new appointment
    $appointment = $this->appointmentRepo->create([...]);

    // 4. Log status history
    $this->appointmentRepo->recordStatusHistory($appointment['id'], null, 'PENDING', $patient['user_id'], 'Initial booking');

    $this->db->commit();
    return $appointment;
} catch (\Throwable $e) {
    if ($this->db->inTransaction()) {
        $this->db->rollBack();
    }
    throw $e;
}
```

If an error or conflict occurs at any point before commit, the entire operation rolls back cleanly, leaving zero orphaned records or half-updated statuses.
