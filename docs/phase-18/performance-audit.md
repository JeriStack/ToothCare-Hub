# Performance and Database Optimization Audit

All measurements below are **actual executed results**. Unmeasured live-load production metrics are explicitly marked `NOT MEASURED`.

---

## 1. Frontend Bundle Optimization (Measured)

- **Original Problem:** `frontend/src/app/App.jsx` eagerly imported all 25 role-specific portal pages (`AdminDashboard`, `ReceptionistDashboard`, `DentistDashboard`, `ReportsPage`, `SystemHealthPage`, `AuditTrailPage`, `RolePermissionMatrixPage`, `DentistTreatmentRecordsPage`, etc.) into a single main chunk.
- **Measurement Method:** Production Vite 8.3.8 build (`npm --prefix frontend run build`).
- **Implemented Change:** Converted 25 role/route portal views in `frontend/src/app/App.jsx` to `React.lazy(...)` wrapped in an accessible `<Suspense fallback={<div role="status" aria-live="polite">Loading view...</div>}>`.

| Metric | Baseline (Before) | After Phase 18 Splitting | Improvement | Status |
|---|---|---|---|---|
| Main `index.js` chunk (raw) | `896.00 kB` | `299.92 kB` | **-66.5% (-596.08 kB)** | **VERIFIED** |
| Main `index.js` chunk (gzip) | `159.23 kB` | `64.88 kB` | **-59.3% (-94.35 kB)** | **VERIFIED** |
| Production build duration | `7.11 s` | `5.97 s` | **-16.0%** | **VERIFIED** |
| On-demand portal chunks | 1 monolithic chunk | 25 lazy-loaded portal chunks (`8.48 kB`–`42.85 kB` raw) | Role-isolated loading | **VERIFIED** |

- **Trade-off:** First navigation to an unvisited tab fetches a small (`2–8 kB` gzip) JS chunk with an accessible `Loading view...` status indicator; subsequent tab switches are instant from browser cache.

---

## 2. Backend & Database Query Review

| Component | Indexing & Query Posture | Measurement Status |
|---|---|---|
| Dashboard queries (`DashboardRepository`) | Uses bounded aggregates and composite reporting indexes from migration `032` (`idx_appointments_service_start`, etc.) | Verified functionally via `Phase15AdminDashboardReportsTest` / `Phase16PerformanceTest`; live MySQL 8 `EXPLAIN ANALYZE` on 100k+ synthetic rows: **NOT MEASURED** in local SQLite sandbox |
| Appointment search (`GET /appointments/search`) | Server-side pagination caps (`limit`/`per_page` bounded `1..100`), allowlisted sort keys, indexed `appointment_date`/`status`/`dentist_id`/`patient_id` | Verified via `Phase16PerformanceTest` & `Phase16ApiContractTest` |
| Slot calculation (`GET /availability`) | Scoped single-date dentist schedule, time-off, closure, and active booking query | Verified via `AvailabilityEngineTest` & `Phase16PerformanceTest` |
| Notification retrieval (`GET /notifications`) | Scoped by `user_id` with bounded pagination | Verified via `NotificationIntegrationTest` |
