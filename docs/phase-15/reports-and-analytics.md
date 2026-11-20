# Phase 15 — Operational Reports and Analytics

## Endpoints (Permission: `reports.view`, Administrator Only)

All report endpoints validate `start_date` and `end_date` (`YYYY-MM-DD`, inclusive `Asia/Manila` boundaries) and return **`422 Unprocessable Entity`** for malformed dates or `end_date < start_date`.

1. **`GET /api/v1/admin/reports/appointments`**
   - Total appointments, status distribution (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`), upcoming count in range, completion rate %, cancellation rate %, and daily volume breakdown.
2. **`GET /api/v1/admin/reports/services`**
   - Operational service utilization only (no fabricated revenue): `total_booked`, `pending_count`, `confirmed_count`, `upcoming_count`, `completed_count`, `cancelled_count`, and `utilization_share_pct` per dental service.
3. **`GET /api/v1/admin/reports/dentists`**
   - Provider workload per dentist: `total_assigned`, `pending_count`, `upcoming_count`, `completed_count`, `confirmed_count`, and `cancelled_count`, ordered deterministically (`completed_count DESC, d.id ASC`).
4. **`GET /api/v1/admin/reports/patients`**
   - Total registered patients, active vs. inactive counts, new registrations in the selected period, and daily `registration_timeline`.

## Financial / Revenue Policy

Because ToothCare Hub does not include a payment ledger or billing settlement subsystem, the Reports UI (`ReportsPage.jsx`) intentionally omits inferred revenue totals and focuses strictly on verified operational counts and utilization shares. (The legacy `/api/v1/admin/reports/revenue` endpoint remains in the backend only for backward compatibility with prior integration tests and now enforces the same strict date validation.)
