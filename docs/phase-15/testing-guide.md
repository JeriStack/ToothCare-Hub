# Phase 15 — Testing Guide

## Backend Tests (PHPUnit)

Run the Phase 15 integration suite:
```powershell
.\backend\vendor\bin\phpunit.bat -c backend/phpunit.xml backend/tests/Integration/Phase15DashboardSearchReportsTest.php
```

Run the complete backend test suite:
```powershell
composer --working-dir=backend test
```

Covered scenarios in `Phase15DashboardSearchReportsTest`:
- All 7 administrator dashboard metrics against an exact known dataset (including inactive dentist profiles, suspended dentist user accounts, inactive services, future vs. past appointments, and zero-duplication counts).
- Combined appointment filters (`start_date`, `end_date`, `dentist_id`, `patient_id`, `service_id`, `status`) and `422` validation for `end_date < start_date`, invalid status, and invalid IDs.
- Strict server-side role isolation on `/api/v1/appointments/search` (patient cannot escalate `patient_id`; dentist cannot escalate `dentist_id`; non-admins receive `403` on admin dashboards, reports, and operations).
- Pagination bounds clamping (`limit=500 → 100`), deterministic ordering with 120 identical-timestamp rows (zero overlap between Page 1 and Page 2), and SQL-level dentist pagination.
- Operational reports (`appointments`, `services`, `dentists`, `patients`) and date-range validation.
- Operational outbox and error views authorization and secret/path/stack-trace redaction.

## Frontend Tests (Vitest + React Testing Library)

Run the Phase 15 UI tests:
```powershell
npm --prefix frontend test -- --run src/tests/phase15/Phase15DashboardsReportsSearch.test.jsx
```

Run the full frontend unit/integration suite and production build:
```powershell
npm --prefix frontend test -- --run --maxWorkers=2
npm --prefix frontend run build
```
