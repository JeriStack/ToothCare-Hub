# Phase 15 — Dashboard Metrics Specification

## Core Principle

MySQL is the single authoritative source of truth for every dashboard statistic across all four roles (`ADMIN`, `RECEPTIONIST`, `DENTIST`, `PATIENT`). No hard-coded fallback counts or fabricated trends are used in the frontend; API failures render an explicit error state with retry controls.

## Clinic Timezone & Date Boundaries

All dashboard date boundaries are evaluated in **`Asia/Manila` (UTC+8)** using PHP `DateTimeImmutable`:
- **Today**: `[YYYY-MM-DD 00:00:00, YYYY-MM-DD 23:59:59]` inclusive.
- **Current instant (`now`)**: `YYYY-MM-DD HH:MM:SS` in `Asia/Manila`.
- **14-day trend window**: `[today - 13 days 00:00:00, today 23:59:59]` inclusive.

## Administrator Dashboard Metrics (`GET /api/v1/admin/dashboard` & `/api/v1/admin/dashboard/summary`)

Permission required: `dashboard.view` (Administrator).

| Metric | Source Table(s) | Authoritative SQL Definition | Notes |
| --- | --- | --- | --- |
| **Total Patients** | `patients` | `SELECT COUNT(*) FROM patients` | Unique patient rows; active subset joins `users.is_active = 1`. |
| **Active Dentists** | `dentists`, `users` | `SELECT COUNT(*) FROM dentists d INNER JOIN users u ON d.user_id = u.id WHERE d.is_active = 1 AND u.is_active = 1` | Excludes both inactive profiles and suspended user accounts. |
| **Active Services** | `services` | `SELECT COUNT(*) FROM services WHERE is_active = 1` | Excludes archived/disabled procedures. |
| **Pending Appointment Requests** | `appointments` | `SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END)` | Awaiting administrative/front-desk triage. |
| **Upcoming Appointments** | `appointments` | `SUM(CASE WHEN status IN ('PENDING', 'CONFIRMED') AND start_at >= :now THEN 1 ELSE 0 END)` | Future eligible appointments only; excludes `COMPLETED`, `CANCELLED`, and `REJECTED`. |
| **Completed Appointments** | `appointments` | `SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)` | Based strictly on authoritative status, never inferred from past dates. |
| **Cancelled Appointments** | `appointments` | `SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)` | Counts appointment rows directly; avoids double-counting `appointment_status_history`. |

All 7 appointment aggregates are computed in a **single conditional aggregate query** to avoid repeated table scans.

## Role-Appropriate Dashboards

- **Receptionist (`GET /api/v1/receptionist/dashboard`)**: Today's appointments, pending requests, upcoming appointments, attendance check-in/waiting/in-consultation counts, and global appointment status distribution. No admin audit logs or system settings exposed.
- **Dentist (`GET /api/v1/dentist/dashboard`)**: Strictly scoped to authenticated `dentist_id`. Computed via a single SQL aggregate query (`today_count`, `upcoming_count`, `pending_count`, `completed_count`, `cancelled_count`, `status_distribution`, weekly summary, and bounded `LIMIT 1` next appointment).
- **Patient (`GET /api/v1/patient/dashboard`)**: Strictly scoped to authenticated `patient_id` (`upcoming_count`, `pending_count`, `completed_count`, `cancelled_count`, `unread_notifications_count`, next visits, pending requests, and recent status history).
