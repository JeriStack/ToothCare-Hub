# Phase 15 — Appointment Search and Advanced Filtering

## Endpoints

| Endpoint | Roles | Scope Enforcement |
| --- | --- | --- |
| `GET /api/v1/appointments/search` | `ADMIN`, `RECEPTIONIST`, `DENTIST`, `PATIENT` | Server-side role routing: Admin/Receptionist search clinic-wide; Dentist strictly scoped to own `dentist_id`; Patient strictly scoped to own `patient_id`. |
| `GET /api/v1/admin/appointments` | `ADMIN`, `RECEPTIONIST` (`appointments.view`) | Clinic-wide with all filters enabled. |
| `GET /api/v1/dentist/appointments` | `DENTIST`, `ADMIN` (`appointments.view`) | Strictly scoped to authenticated `dentist_id`; client-supplied `dentist_id`/`patient_id` ignored. |
| `GET /api/v1/appointments` | `PATIENT` (authenticated) | Strictly scoped to authenticated `patient_id`; client-supplied `patient_id` ignored. |

## Supported Query Parameters

- `start_date` (aliases: `date_from`, `from`): Inclusive lower bound (`YYYY-MM-DD` → `00:00:00` Asia/Manila, or `YYYY-MM-DD HH:MM:SS`).
- `end_date` (aliases: `date_to`, `to`): Inclusive upper bound (`YYYY-MM-DD` → `23:59:59` Asia/Manila, or `YYYY-MM-DD HH:MM:SS`).
- `dentist_id`: Positive integer (Admin, Receptionist, Patient).
- `patient_id`: Positive integer (Admin, Receptionist only).
- `service_id`: Positive integer (all roles).
- `status`: Allowlisted uppercase enum: `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED` (or `ALL`).
- `search`: Escaped `LIKE` match on patient name, email, phone, or service name (max 120 chars).
- `page`: Integer `>= 1` (default `1`).
- `per_page` (alias: `limit`): Integer clamped to `[1, 100]` (default `20`).

## Server-Side Validation Rules

- Malformed dates or non-calendar dates (e.g. `2026-02-30`) return **`422 Unprocessable Entity`**.
- `end_date < start_date` returns **`422 Unprocessable Entity`**.
- Invalid `status` outside the official enum returns **`422 Unprocessable Entity`**.
- Non-numeric or non-positive `dentist_id`, `patient_id`, or `service_id` returns **`422 Unprocessable Entity`**.

## Frontend Search Behavior (`AdminAppointmentsPage.jsx`)

- Combines status chips, text search, dentist dropdown, dental service dropdown, and start/end date inputs.
- Validates `end_date >= start_date` inline before issuing requests.
- Resets `page` to `1` whenever any filter changes.
- Uses a monotonic `requestSeqRef` guard so out-of-order stale responses never overwrite newer search results.
- Provides a one-click **Clear Filters** action and accessible labels for all controls.
