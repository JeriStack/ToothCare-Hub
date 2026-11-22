# Phase 15 — Operational Visibility & Troubleshooting Views

## Endpoints (Permission: `system.health` / `audit_logs.view`, Administrator Only)

1. **`GET /api/v1/admin/audit-logs`** & **`GET /api/v1/admin/security/events`**
   - Append-only forensic audit trail (`audit_logs`) with timestamp, actor email/role, action, target entity, and sanitized payload.
   - Historical audit records cannot be edited or deleted via the API.
   - Appointment status transitions remain stored separately in `appointment_status_history`.

2. **`GET /api/v1/admin/operations/outbox?channel=email|realtime&status=...&page=1&per_page=20`**
   - Unified read-only summary across both existing outbox tables (`email_outbox` and `realtime_outbox`): pending/retry, processing, delivered, and failed counts.
   - Paginated job metadata (event ID/key, status, attempt count, max attempts, timestamps, and sanitized error summary).
   - Never exposes encrypted email bodies, SMTP credentials, or raw notification payloads.
   - Manual retry/abandon actions continue to use the dedicated DRBAC-protected `EmailOutboxController` endpoints (`email_outbox.retry`, `email_outbox.manage`) which record every manual action in `audit_logs`.

3. **`GET /api/v1/admin/operations/errors?page=1&per_page=20`**
   - Aggregates recent delivery failures from `email_outbox` and `realtime_outbox` alongside security/access-control audit events (`AUTH_LOGIN_RATE_LIMITED`, `AUTH_LOGIN_BLOCKED`, `UNAUTHORIZED_APPOINTMENT_ACCESS_ATTEMPT`, `ADMIN_LOCKOUT_PREVENTED`).
   - All error summaries pass through `DashboardRepository::sanitizeErrorSummary()`, which strips stack traces, redacts Windows/Unix filesystem paths (`[path-redacted]`), redacts `password`/`secret`/`token`/`api_key` key-value pairs (`[redacted]`), and truncates to 220 characters.
   - **Known Limitation**: PHP-FPM fatal errors written only to stderr/container logs are observed via Docker/Prometheus/Grafana log aggregation rather than stored in MySQL.
