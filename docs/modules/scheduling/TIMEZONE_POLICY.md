# Phase 9: Timezone Policy & Temporal Integrity
## ToothCare Hub — Dental Appointment and Clinic Management System

---

## 1. Core Principle

ToothCare Hub enforces a strict, unified timezone standard across all architectural tiers:

$$\textbf{System Standard Timezone} = \text{Asia/Manila (UTC+08:00)}$$

Under no circumstances should the system rely on the default host server timezone, client local browser timezone, or ambiguous timestamp strings.

---

## 2. Tier-Specific Standards

### 2.1 Backend (PHP 8.5)
- All date and time calculations instantiate explicit `DateTimeZone('Asia/Manila')` objects.
- All date-time objects use immutable representations (`DateTimeImmutable`) to prevent side-effect mutability bugs.
- Configuration is centralized in `backend/config/app.php`:
  ```php
  'scheduling' => [
      'timezone' => 'Asia/Manila',
      'min_advance_notice_minutes' => 120,
      'max_booking_horizon_days' => 90,
      'default_buffer_minutes' => 10,
      'slot_interval_minutes' => 15,
  ],
  ```

### 2.2 Database (MySQL / InnoDB)
- MySQL session timezone is initialized to `+08:00` upon connection in `Database.php`.
- Stored column types:
  - `DATETIME`: Stored in Manila local time (`YYYY-MM-DD HH:MM:SS`).
  - `TIME`: Stored as `HH:MM:SS`.
- Strict CHECK constraints ensure temporal sanity:
  - `start_at < end_at`
  - `opening_time < closing_time`

### 2.3 REST API (JSON Overrides)
- All API timestamps serialized to the client include the explicit UTC offset:
  `2026-11-10T09:00:00+08:00` (ISO 8601 / RFC 3339).
- Responses include the canonical timezone key:
  ```json
  "timezone": "Asia/Manila"
  ```

### 2.4 Frontend (React / Vite)
- The frontend formats all appointment display strings using explicit `timeZone: 'Asia/Manila'`:
  ```javascript
  new Date(slot.start_at).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  ```
- Prevents overseas patients or remote administrators from seeing shifted slot times based on their client device's clock.

