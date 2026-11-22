# Database and SQL Security Review

## 1. SQL Injection Review

All repository and controller queries across `backend/src/` were audited for `query()`, `exec()`, and string interpolation:

- **Parameterized Queries:** All user-supplied values (emails, names, appointment filters, pagination offsets, status transitions, clinical notes, audit filters) are bound via PDO prepared statements (`$pdo->prepare(...)` + `execute([...])` / `bindValue(...)`).
- **Allowlisted Dynamic Identifiers:** Sorting parameters in search endpoints (`AppointmentRepository`, `AuditLogRepository`, `UserRepository`) map through explicit PHP `match` / allowlist arrays rather than interpolating raw query strings.
- **Hardened Finding (`F-04`):** `DatabaseBackupService::importSqlIntoDatabase()` previously interpolated `$targetDatabase` into `CREATE DATABASE IF NOT EXISTS` and CLI `exec()`. Phase 18 added `DatabaseBackupService::validateDatabaseIdentifier()` enforcing `/^[A-Za-z0-9_]{1,64}$/` and verified rejection of injection payloads in `Phase18HardeningTest`.
- **Static `query()` Calls:** Remaining `$pdo->query(...)` calls in `DashboardRepository`, `ReportController`, `EmailOutboxRepository`, `RealtimeOutboxRepository`, `RoleRepository`, and `PermissionRepository` execute static SQL literals with zero user input.

---

## 2. Schema Integrity & Concurrency Controls

- **Engine & Charset:** MySQL 8.0 `InnoDB` with `utf8mb4` across 32 ordered migrations (`database/migrations/001`–`032`).
- **Concurrency:** Appointment booking and rescheduling use transactional `SELECT ... FOR UPDATE` row locking to prevent double-booking race conditions.
- **Foreign Keys & Unique Constraints:** Enforced across `users`, `patients`, `dentists`, `services`, `appointments`, `appointment_status_history`, `treatment_records`, `notifications`, `email_outbox`, `realtime_outbox`, and `realtime_tickets`.

---

## 3. Database Account & Network Posture

- **Network Exposure:** MySQL runs on the private `app` Docker network. In `compose.dev.yaml`, host port `3306` is bound strictly to `127.0.0.1:3306:3306`. In production (`compose.prod.yaml`), `phpmyadmin` is disabled by default (`profiles: ["tools"]`), and external firewall rules must block port `3306` from public networks.
- **Least Privilege Recommendation (Pre-Production):** Create separate MySQL accounts in production: an application account (`SELECT, INSERT, UPDATE, DELETE` only) and a dedicated migration/backup account (`ALTER, CREATE, DROP, LOCK TABLES`). Enable MySQL TLS (`REQUIRE SSL`) in production environments.
