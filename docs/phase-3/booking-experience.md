# ToothCare Hub — Date, Time & Booking UX Specification

**Document ID:** `TCH-P3-BEX-001`  
**Version:** `1.0.0`  
**Phase:** Phase 3 — Requirements, User Journeys, Wireframes, and Design System  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead Systems Architect & Senior Product Designer  

---

## 1. Clinic Time Zone & Temporal Anchor

To ensure absolute scheduling consistency and eliminate ambiguity across client devices traveling across time zones:

```
CLINIC TIME ZONE CANONICAL ANCHOR:
Time Zone Identifier: Asia/Manila
UTC Offset:           UTC+08:00 (Fixed year-round; Zero Daylight Saving Time)
Database Column Type: DATETIME or TIMESTAMP (Interpreted strictly in Asia/Manila)
Wire API Exchange:    ISO 8601 with explicit offset: YYYY-MM-DDTHH:mm:ss+08:00
```

> [!IMPORTANT]
> **Zero Browser Default Drift:** The frontend must **never** format appointment times using the browser's default local time zone without timezone conversion. An overseas patient booking from California (`UTC-07:00`) or Tokyo (`UTC+09:00`) sees all clinic hours anchored explicitly in **Philippine Standard Time (`Asia/Manila`)**.

---

## 2. Formatting & Display Standards

| Context | Format Pattern | Example Output | Notes |
| :--- | :--- | :--- | :--- |
| **API Wire / Database** | `YYYY-MM-DDTHH:mm:ss+08:00` | `2026-11-03T09:30:00+08:00` | Unambiguous ISO 8601 with offset |
| **Full Date (Human)** | `dddd, MMMM D, YYYY` | `Tuesday, November 3, 2026` | Patient booking summary & confirmation |
| **Short Date (Table)** | `MMM D, YYYY` | `Nov 3, 2026` | Data tables & compact cards |
| **Time Format** | `hh:mm A` | `09:30 AM` | 12-hour format with capitalized AM/PM |
| **Time Range** | `hh:mm A – hh:mm A` | `09:30 AM – 10:15 AM` | Procedure duration window |
| **Relative Duration** | `X days, Y hours` | `in 6 days, 4 hours` | Time-to-visit countdown |

---

## 3. Booking Window & Horizon Policies

```
+-------------------------------------------------------------------------------+
| PAST DATES     | MIN ADVANCE NOTICE | VALID BOOKING HORIZON | FUTURE HORIZON  |
| (Blocked)      | (2 Hours Ahead)    | (Up to 60 Days Ahead) | (Blocked)       |
| < Earlier      | [NOW() + 2h]       | === 60 Calendar Days === | [Day 61+] >  |
+-------------------------------------------------------------------------------+
```

1. **Minimum Advance Booking Window:** A booking request must be placed at least **2 hours** before the requested start time (`start_at >= NOW() + 2 hours`). This prevents patients from booking slots that receptionists have no time to review or prepare operatory chairs for.
2. **Maximum Booking Horizon:** Patients can schedule up to **60 calendar days** into the future. Dates beyond 60 days are disabled in the calendar picker to prevent stale schedule locks.
3. **Past Dates & Clinic Holidays:** Past days, days where the clinic is closed (e.g., Sundays, national holidays), and days where no dentists have scheduled shifts are disabled (`aria-disabled="true"`).

---

## 4. 30-Minute Grid Slot Generation Engine

### 4.1 Grid Algorithm Overview
The clinic operates on a standardized **30-minute grid** (`09:00`, `09:30`, `10:00`, `10:30`, etc.).

```
Service Duration:  45 Minutes
Start Slot Picked: 09:30 AM
Occupied Window:   09:30 AM – 10:15 AM
Grid Blocks Used:  Two 30-minute blocks (09:30 - 10:00 and 10:00 - 10:30)
Next Avail. Slot:  10:30 AM (or 10:15 if clinic allows 15m offset; default 10:30)
```

### 4.2 Overlap Detection Formula
A time slot is available if and only if **no** overlapping appointment in status `PENDING` or `CONFIRMED` exists for the target dentist or chair:

$$\text{Overlap Condition: } \quad (\text{existing.start\_at} < \text{req.end\_at}) \quad \land \quad (\text{existing.end\_at} > \text{req.start\_at})$$

```sql
-- Core Concurrency Overlap Query (Executed with FOR UPDATE in Transaction)
SELECT id, start_at, end_at, status 
FROM appointments 
WHERE dentist_id = :dentist_id 
  AND status IN ('PENDING', 'CONFIRMED') 
  AND start_at < :req_end_at 
  AND end_at > :req_start_at 
FOR UPDATE;
```

---

## 5. Concurrency Race Condition & Conflict UX

### 5.1 The Concurrency Threat
In a popular clinic, two patients (Patient A and Patient B) might simultaneously view slot `09:30 AM` for Dr. Santos on November 3. Both submit their requests within 200 milliseconds of each other.

### 5.2 Resolution Lifecycle
```mermaid
sequenceDiagram
    autonumber
    actor A as Patient A
    actor B as Patient B
    participant API as PHP API
    participant DB as MySQL Database

    A->>API: POST /api/appointments (Slot 09:30 - 10:15)
    B->>API: POST /api/appointments (Slot 09:30 - 10:15)

    Note over API,DB: Transaction A Locks Rows
    API->>DB: START TRANSACTION; SELECT ... FOR UPDATE (Slot 09:30)
    DB-->>API: 0 overlapping rows found
    API->>DB: INSERT INTO appointments (status='PENDING'); COMMIT;
    API-->>A: 201 Created (Appointment #1042)

    Note over API,DB: Transaction B Executes Immediately After
    API->>DB: START TRANSACTION; SELECT ... FOR UPDATE (Slot 09:30)
    DB-->>API: 1 row found (#1042 in PENDING)
    API->>DB: ROLLBACK;
    API-->>B: 409 Conflict {"code": "SLOT_OCCUPIED", "message": "This slot was just reserved."}

    Note over B: Client Gracefully Handles 409
    B->>B: Displays Conflict Modal + Auto-refreshes available slots
```

### 5.3 User-Facing Conflict Dialog
When Patient B receives HTTP `409 Conflict`:
1. Modal pops with title: `[!] Selected Time Slot Just Reserved`.
2. Body: *"Another patient completed booking this slot seconds ago. We apologize for the inconvenience."*
3. Alternative Recommendation: Displays nearest available slots for the same dentist (e.g., `10:30 AM`, `11:15 AM`, `02:00 PM`).
4. Action: Single-click to select recommended alternative or choose a different day.

---

## 6. Verification & Acceptance Criteria
- [x] **AC-B1:** All dates and times transmitted in ISO 8601 with explicit `+08:00` offset (`Asia/Manila`).
- [x] **AC-B2:** Slot generation correctly blocks both `PENDING` and `CONFIRMED` appointments.
- [x] **AC-B3:** Minimum 2-hour advance booking and maximum 60-day horizon enforced on client and server.
- [x] **AC-B4:** High-concurrency automated tests demonstrate zero double-bookings under parallel request bursts.
