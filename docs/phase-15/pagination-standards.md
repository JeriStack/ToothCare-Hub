# Phase 15 — Global Pagination Standards

## Policy

Every list endpoint that can grow unbounded enforces server-side SQL pagination (`LIMIT` + `OFFSET`):
- **Default page size**: `20` (or `15`–`25` where established by existing UI pages).
- **Maximum page size**: `100` (values above `100` are clamped server-side to `100`; values `< 1` clamp to `1`).
- **Query parameters**: Accepts both `per_page` and `limit`, plus `page` (`>= 1`).
- **Deterministic ordering**: Every paginated query appends a unique primary-key tie-breaker (e.g., `ORDER BY start_at DESC, a.id DESC` or `ORDER BY created_at DESC, id DESC`) so records sharing identical timestamps never duplicate or drop across page boundaries.

## Audited Endpoints

| Module | Endpoint | SQL Pagination | Max Limit | Deterministic Tie-Breaker |
| --- | --- | --- | ---: | --- |
| Appointments (Admin/Search) | `GET /api/v1/admin/appointments`, `/api/v1/appointments/search` | Yes | 100 | `a.start_at DESC, a.id DESC` |
| Appointments (Dentist) | `GET /api/v1/dentist/appointments` | Yes (upgraded from PHP slice to SQL) | 100 | `a.start_at ASC, a.id ASC` |
| Appointments (Patient) | `GET /api/v1/appointments` | Yes | 100 | `a.start_at DESC, a.id DESC` |
| Patients | `GET /api/v1/admin/patients` | Yes | 100 | `{$sortColumn} {$dir}, p.id {$dir}` |
| Dentists | `GET /api/v1/admin/dentists` | Yes | 100 | `{$sortColumn} {$dir}, d.id {$dir}` |
| Services | `GET /api/v1/admin/services` | Yes | 100 | `{$sortColumn} {$dir}, id {$dir}` |
| Users | `GET /api/v1/admin/users` | Yes | 100 | `{$sortColumn} {$dir}, u.id {$dir}` |
| Notifications | `GET /api/v1/notifications` | Yes | 100 | `created_at DESC, id DESC` |
| Audit Logs | `GET /api/v1/admin/audit-logs` | Yes | 100 | `{$sortCol} {$dir}, al.id {$dir}` |
| Security Events | `GET /api/v1/admin/security/events` | Yes (upgraded to paginated) | 100 | `al.created_at DESC, al.id DESC` |
| Email Outbox Jobs | `GET /api/v1/admin/email-outbox/jobs` | Yes | 100 | `id DESC` |
| Unified Outbox Operations | `GET /api/v1/admin/operations/outbox` | Yes | 100 | `created_at DESC, id DESC` |
| Operational Errors | `GET /api/v1/admin/operations/errors` | Yes | 100 | `timestamp DESC, id DESC` |
| Treatment Records | `GET /api/v1/treatment-records` | Yes | 100 | `tr.created_at DESC, tr.id DESC` |
