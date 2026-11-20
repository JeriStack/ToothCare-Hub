# Phase 15 — Query Optimization & Indexing

## Migration 032 (`database/migrations/032_add_reporting_and_dashboard_indexes.sql`)

After auditing existing indexes in migrations `003`, `004`, `005`, `008`, `011`, `014`, `029`, and `031`, four non-redundant composite indexes were added:

| Index | Table | Columns | Purpose |
| --- | --- | --- | --- |
| `idx_appointments_service_start` | `appointments` | `(service_id, start_at)` | Accelerates service-filtered appointment search and `/admin/reports/services` utilization joins. |
| `idx_appointments_start_status` | `appointments` | `(start_at, status)` | Accelerates date-range dashboard aggregations, today's schedule, and daily report timelines. |
| `idx_patients_created_at` | `patients` | `(created_at)` | Accelerates `/admin/reports/patients` registration trend queries. |
| `idx_dentists_active_user` | `dentists` | `(is_active, user_id)` | Accelerates active dentist count joins against `users.is_active`. |

## Query Improvements Implemented

1. **Single-Pass Conditional Aggregation**: Replaced 6 separate `SELECT COUNT(*)` queries in `DashboardRepository::getMetrics()` and PHP-side loops in `AppointmentService::getDentistDashboardSummary()` with single conditional `SUM(CASE WHEN ...)` SQL queries.
2. **Eliminated Unbounded Memory Loads**: Replaced `AppointmentRepository::findByDentist()` + PHP `array_slice()` in `listDentistAppointments()` with `AppointmentRepository::findByDentistPaginated()` using SQL `COUNT(*)` + `LIMIT`/`OFFSET`.
3. **Index-Friendly Date Ranges**: Replaced `WHERE DATE(start_at) = ?` in `ReceptionistService::getDashboardSummary()` with `WHERE start_at >= ? AND start_at <= ?` so B-tree indexes on `start_at` are used instead of full-table function scans.
4. **Synthetic Dataset Benchmark (120+ rows, SQLite in-memory PHPUnit)**:
   - `Phase15DashboardSearchReportsTest` (6 integration tests including 120-row pagination stress test, combined filters, dashboard aggregates, reports, and outbox/error redaction) completes in **1.56s** total (12 MB peak memory).
