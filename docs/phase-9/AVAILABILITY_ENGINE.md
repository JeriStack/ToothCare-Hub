# Phase 9: Availability Engine Architecture
## ToothCare Hub — Dental Appointment and Clinic Management System

---

## 1. Engine Architecture

The **Availability Engine** (`App\Services\AvailabilityService`) is the centralized source of truth for calculating bookable appointment intervals across the system. It replaces all decentralized, ad-hoc, or client-side date arithmetic.

```
+-------------------------------------------------------------+
|                     AvailabilityService                     |
|                                                             |
|   +-------------------+              +------------------+   |
|   | DentistRepository |              | ServiceRepository|   |
|   +-------------------+              +------------------+   |
|            |                                   |            |
|            v                                   v            |
|   +-------------------+              +------------------+   |
|   | DentistSchedule   |              | ClinicSchedule   |   |
|   | Repository        |              | Repository       |   |
|   +-------------------+              +------------------+   |
|            |                                   |            |
|            v                                   v            |
|   +-------------------+              +------------------+   |
|   | DentistTimeOff    |              | Appointment      |   |
|   | Repository        |              | Repository       |   |
|   +-------------------+              +------------------+   |
+-------------------------------------------------------------+
```

---

## 2. Slot Generation Algorithm

The algorithm executes in 5 sequential steps:

### Step 1: Input Validation and Range Normalization
1. Validates that the requested dentist exists and is active (`is_active = 1`).
2. Validates that the requested dental service exists and is active (`is_active = 1`).
3. Anchors query parameters to `Asia/Manila` timezone:
   - Rejects dates in the past: $T_{\text{start}} < \text{today}_{\text{Manila}}$.
   - Rejects ranges exceeding the maximum booking horizon of 90 days.
   - Enforces a maximum window of 14 days per request to prevent resource exhaustion.

### Step 2: Batch Data Pre-fetching
To prevent N+1 query overhead, the service performs batched queries across the requested date window $[T_{\text{start}}, T_{\text{end}}]$:
- Clinic operating hours for all 7 weekdays.
- Clinic closures overlapping $[T_{\text{start}} \text{ 00:00:00}, T_{\text{end}} \text{ 23:59:59}]$.
- Active dentist shifts for the dentist.
- Dentist time-off overlapping the window.
- Blocking appointments (`PENDING`, `CONFIRMED`) overlapping the window.

### Step 3: Day-by-Day Iteration
For each date in the range:
1. Resolves weekday index $N \in [1, 7]$ (1=Monday ... 7=Sunday).
2. Looks up facility operating hours. If $is\_closed = 1$, the day is marked closed and yields zero slots.
3. Retrieves dentist active recurring shifts for weekday $N$.

### Step 4: Shift Clamping & Interval Generation
For each dentist shift:
1. Clamps shift start and end to the clinic's operating hours:
   $$T_{\text{effective\_start}} = \max(T_{\text{shift\_start}}, T_{\text{clinic\_open}})$$
   $$T_{\text{effective\_end}} = \min(T_{\text{shift\_end}}, T_{\text{clinic\_close}})$$
2. If $T_{\text{effective\_start}} \ge T_{\text{effective\_end}}$, skip shift.
3. Initializes cursor $T_{\text{cursor}} = T_{\text{effective\_start}}$.
4. Computes candidate service end:
   $$T_{\text{service\_end}} = T_{\text{cursor}} + \text{duration\_minutes}$$
5. Computes candidate blocking end:
   $$T_{\text{blocking\_end}} = T_{\text{service\_end}} + \text{buffer\_minutes}$$

### Step 5: Boundary & Precedence Filtering
For each candidate slot $[T_{\text{cursor}}, T_{\text{blocking\_end}})$:
1. **Schedule Boundary**: If $T_{\text{blocking\_end}} > T_{\text{effective\_end}}$, stop stepping for this shift (no further slots will fit).
2. **Advance Notice**: If $T_{\text{cursor}} < T_{\text{now}} + 120\text{ min}$, increment cursor by 15 minutes and continue.
3. **Clinic Closure Conflict**: If slot overlaps any closure $[C_{\text{start}}, C_{\text{end}})$, increment cursor and continue.
4. **Dentist Time-Off Conflict**: If slot overlaps any practitioner leave $[L_{\text{start}}, L_{\text{end}})$, increment cursor and continue.
5. **Existing Appointment Conflict**: If slot overlaps any active booking $[A_{\text{start}}, A_{\text{end}})$, increment cursor and continue.
6. **Slot Accepted**: Record slot with ISO 8601 timestamps, duration, buffer, and chair allocation. Advance cursor by 15 minutes.

