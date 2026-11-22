# Phase 16 — Performance & Concurrency Testing

## Concurrency Coverage

- **Overlapping Booking Prevention**: `AppointmentConcurrencyTest` and `Phase16BusinessRuleRegressionTest` verify that adjacent back-to-back appointments (`10:00–10:30` and `10:30–11:00`) succeed while overlapping slots (`10:15–10:45`) are rejected with `409 Conflict`, backed by InnoDB row locking (`SELECT ... FOR UPDATE`) on MySQL 8.0.
- **Outbox Contention & Retries**: `EmailOutboxFlowTest` verifies atomic batch claiming, lock expiration recovery, transient retry scheduling, and idempotent event keys.
- **Real-Time Idempotency**: `realtime/tests/realtime.test.ts` verifies duplicate `eventId` delivery suppression and reconnection recovery via REST.

## Query Performance Baselines

- **Composite Indexes (Migration 032)**: `idx_appointments_service_start`, `idx_appointments_start_status`, `idx_patients_created_at`, `idx_dentists_active_user`.
- **Single-Pass SQL Aggregates**: Dashboard and dentist KPIs execute single conditional `SUM(CASE WHEN ...)` queries instead of per-status loops or loading full tables into PHP memory.
- **Synthetic 120-Row Pagination Stress Test**: `Phase15DashboardSearchReportsTest` inserts 120 identical-timestamp rows, enforces max-100 clamping, verifies zero cross-page overlap, and completes all 6 tests in `~1.56s` (`12 MB` peak memory).
