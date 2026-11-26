# Server-Side Data Tables Architecture & Operations Guide

## 1. Architecture Overview

ToothCare Hub processes large administrative and clinical tables strictly on the server so browsers only ever receive the rows required for the active page:

- **Frontend (`React 19.3` + `Vite 8` + `Tailwind CSS 3.4` + native `apiClient.js`)**:
  - Uses a zero-dependency server-driven model (`serverSide: true` equivalent) via [`frontend/src/hooks/useServerTable.js`](../frontend/src/hooks/useServerTable.js) and [`frontend/src/components/ui/ServerTableControls.jsx`](../frontend/src/components/ui/ServerTableControls.jsx).
  - No second table library or duplicate HTTP client is introduced.
- **Backend (`PHP 8.5` + `PDO`)**:
  - Central query validation, deterministic allowlisted sorting, wildcard-safe `LIKE` escaping, and unified metadata envelope live in [`backend/src/Support/ServerTableQuery.php`](../backend/src/Support/ServerTableQuery.php).
- **Database (`MySQL 8.0` / SQLite in-memory tests)**:
  - Database-level `LIMIT :limit OFFSET :offset` with bound `PDO::PARAM_INT`, explicit column projections, and composite indexes matching filter + sort paths.

---

## 2. API Request & Response Contract

### Standard Request Parameters

Example:
```http
GET /api/v1/admin/appointments?page=1&per_page=25&search=Maria&status=CONFIRMED&dentist_id=2&service_id=1&start_date=2026-12-01&end_date=2026-12-31&sort_by=start_at&sort_dir=desc
```

| Parameter | Type | Constraints / Behavior |
|---|---|---|
| `page` | integer | `>= 1` (capped at `100000`). Non-integer or `<= 0` returns `422`. |
| `per_page` | integer | `>= 1`, max `100` (excessive values clamped safely to `100`; invalid/non-positive returns `422`). |
| `search` | string | Trimmed, capped at `120` chars, literal-escaped (`!`, `%`, `_`) with `ESCAPE '!'`. |
| `sort_by` | enum string | Must match the endpoint's backend allowlist; unrecognized values return `422` on strict endpoints. |
| `sort_dir` | enum string | `asc` or `desc` (case-insensitive); invalid values return `422`. |
| Resource filters | typed | `status`, `dentist_id`, `service_id`, `patient_id`, `start_date`/`end_date`, `role`, `is_active`, `target_type`, etc. Inverted date ranges (`start_date > end_date`) return `422`. |

### Standard Response Envelope

```json
{
  "status": "success",
  "data": [ /* Current page rows only */ ],
  "meta": {
    "total": 42,
    "total_records": 1250,
    "filtered_records": 42,
    "page": 1,
    "current_page": 1,
    "per_page": 25,
    "last_page": 2,
    "total_pages": 2,
    "sorting": {
      "sort_by": "start_at",
      "sort_dir": "desc"
    }
  }
}
```

- `total_records`: Total rows accessible to the authenticated actor **before** user-selected filters (strictly scoped by role/ownership).
- `filtered_records`: Total rows matching active search and filter criteria.
- Backward-compatible aliases (`total`, `page`, `last_page`) are retained for all existing clients and contract tests.

---

## 3. Allowed Sort Columns & Filterable Fields

### `/api/v1/admin/appointments` (`AppointmentRepository::ADMIN_SORT_ALLOWLIST`)
- **Sortable (`sort_by`)**: `id`, `start_at`, `created_at`, `status`, `patient_name` (`p.last_name, p.first_name`), `dentist_name` (`d.last_name, d.first_name`), `service_name` (`s.name`).
- **Deterministic tie-breaker**: Always appends `a.id <DIR>`.
- **Filterable**: `search` (patient name, full name, email, phone, service name, `#id` / `TC-id`), `status`, `dentist_id`, `service_id`, `patient_id`, `start_date`, `end_date`.

### Other Hardened Repositories
- **Patients (`PatientRepository`)**: Sortable `id`, `first_name`, `last_name`, `name`, `date_of_birth`, `phone`, `gender`, `created_at`, `email`, `is_active` + `p.id` tie-breaker.
- **Users (`UserRepository`)**: Sortable `created_at`, `email`, `role`, `id` + `u.id` tie-breaker.
- **Audit Logs (`AuditLogRepository`)**: Sortable `created_at`, `id`, `action` + `al.id` tie-breaker.
- **Dentists (`DentistRepository`)**: Sortable `id`, `name`, `specialization`, `license_number`, `is_active`, `created_at` + `d.id` tie-breaker.
- **Services (`ServiceRepository`)**: Sortable `id`, `name`, `price`, `duration_minutes`, `category`, `is_active`, `created_at` + `id` tie-breaker.

---

## 4. Debounce & Request Cancellation Strategy

- **Search debounce**: `300ms` timer in `useServerTable` and `AdminAppointmentsPage` prevents per-keystroke API floods and automatically resets `page` to `1`.
- **Immediate execution**: Pagination (`Previous`/`Next`), page-size changes, column sorting, filter selects, and manual refresh bypass debounce and execute immediately.
- **Cancellation & race-condition guard**:
  1. Each new request aborts any in-flight `AbortController` and passes `{ signal }` into `apiClient.get(...)`.
  2. A monotonic `requestSeqRef` sequence counter guarantees out-of-order responses from older requests are silently discarded.
  3. Unmounting the component aborts any active request.

---

## 5. Pagination & Maximum Page-Size Policy

- Frontend page-size selector (`ServerTableFooter`) offers `10`, `15`, `25`, `50`, and `100` rows per page.
- Backend `ServerTableQuery::MAX_PER_PAGE = 100` caps any request above `100` to `100` and rejects `<= 0` or non-integer values with HTTP `422`.
- `ServerTableQuery::MAX_PAGE = 100000` prevents pathological offset overflow.

---

## 6. Database Indexes & Query Optimization

In addition to existing indexes (`idx_appointments_status_start`, `idx_appointments_dentist_start`, `idx_appointments_patient_start`, `idx_appointments_service`, `idx_audit_logs_created`, `idx_audit_logs_actor`), migration [`035_add_server_table_sort_and_filter_indexes.sql`](../database/migrations/035_add_server_table_sort_and_filter_indexes.sql) adds three targeted composite indexes:

1. `idx_appointments_created_id ON appointments (created_at, id)` — supports `sort_by=created_at` with deterministic `id` tie-breaker.
2. `idx_audit_logs_target_created ON audit_logs (target_type, created_at, id)` — accelerates module-filtered Audit Trail pages.
3. `idx_users_role_active_created ON users (role, is_active, created_at)` — accelerates role/status-filtered User Management tables.

Additional SQL optimizations:
- **Zero redundant counts**: When no user filters are active, `total_records` reuses `filtered_records` without issuing a second `COUNT(*)` query.
- **No `SELECT a.*` bloat on admin listing**: `AppointmentRepository::findAllFiltered()` projects only the columns required by the table and triage UI.
- **Join safety**: `UserRepository::list()` uses `COUNT(DISTINCT u.id)` across optional `LEFT JOIN` tables so counts never duplicate.

---

## 7. Security & Authorization Controls

- **Authentication**: Enforced via session cookie middleware (`401 Unauthorized` when missing).
- **RBAC / DRBAC**: Administrative tables require explicit permissions (`appointments.view_all`, `users.manage`, `audit.view`, etc.) enforced server-side (`403 Forbidden` for unauthorized roles).
- **Ownership-scoped counts**:
  - Patient endpoints (`/api/v1/appointments/search`) always scope **both** `filtered_records` and `total_records` to `patient_id = :patient_id`.
  - Dentist endpoints (`/api/v1/dentist/appointments`) always scope **both** counts to `dentist_id = :dentist_id`.
  - Users can never infer the existence or total count of another user's records.
- **SQL injection & wildcard defense**:
  - Prepared statements and bound parameters for all values; integer binding (`PDO::PARAM_INT`) for `LIMIT` and `OFFSET`.
  - Strict allowlist mapping for `ORDER BY` expressions.
  - Literal wildcard escaping (`!`, `%`, `_` with `ESCAPE '!'`) works identically across MySQL 8.0 and SQLite 3.

---

## 8. Extending to Additional Data Tables

1. **Backend**: Parse pagination with `ServerTableQuery::parsePagination($request->getQuery())`, validate sorting with `ServerTableQuery::parseSort(...)`, escape search inputs with `ServerTableQuery::escapeLike(...)` + `ESCAPE '!'`, compute scoped `total_records` and `filtered_records`, and emit `ServerTableQuery::buildMeta(...)`.
2. **Frontend**: Wire `useServerTable({ fetcher, initialPerPage, initialSortBy, initialSortDir, initialFilters })` and render `<SortableColumnHeader />` + `<ServerTableFooter />`.

---

## 9. Verification Commands

```bash
# Backend Unit & Integration Suites (including ServerSideDataTableTest & 1,000-row benchmark)
php backend/vendor/bin/phpunit -c backend/phpunit.xml --testsuite Unit
php backend/vendor/bin/phpunit -c backend/phpunit.xml --testsuite Integration

# OpenAPI Spec Drift & Schema Validation
php backend/scripts/generate-openapi.php --check
php backend/scripts/validate-openapi.php

# Frontend Server-Side Table & Regression Tests + Production Build
npm --prefix frontend test -- --run src/tests/tables/ServerSideDataTable.test.jsx src/tests/appointments/AdminAppointmentsPage.test.jsx src/tests/phase15/Phase15DashboardsReportsSearch.test.jsx
npm --prefix frontend run build
```

---

## 10. Known Limitations & Future Scaling

- **Deep offset pagination**: Offset pagination (`LIMIT/OFFSET`) scales cleanly for tens of thousands of clinic records with the composite indexes above. If a single table grows beyond hundreds of thousands of rows and users routinely page deep into history, consider offering an opt-in keyset/cursor mode (already implemented internally in `AppointmentRepository::findPendingChunkAfterId()`).
- **Leading-wildcard `LIKE '%term%'`**: Substring search across multiple joined columns cannot use standard B-Tree prefix scans at very large scale. Monitor slow query logs (`long_query_time`) and consider MySQL `FULLTEXT` indexes only when real production telemetry justifies the write overhead.
