# ToothCare Hub — Database Architecture & Operations Guide
**Phase 4:** Database Modeling and Versioned Schema  
**Database Server:** MySQL 8.0 (InnoDB Engine)  
**Default Collation:** `utf8mb4_unicode_ci`  
**Target Database Name:** `toothcare_hub`  

---

## 1. Directory Structure

```text
database/
├── migrations/                           # Ordered versioned SQL DDL migrations
│   ├── 001_create_schema_migrations.sql
│   ├── 002_create_users.sql
│   ├── 003_create_patients.sql
│   ├── 004_create_dentists.sql
│   ├── 005_create_services.sql
│   ├── 006_create_dentist_schedules.sql
│   ├── 007_create_dentist_time_off.sql
│   ├── 008_create_appointments.sql
│   ├── 009_create_appointment_status_history.sql
│   ├── 010_create_treatment_records.sql
│   ├── 011_create_notifications.sql
│   ├── 012_create_email_outbox.sql
│   ├── 013_create_auth_tokens.sql
│   └── 014_create_audit_logs.sql
├── seeds/                                # Synthetic development seed dataset
│   └── development_seed.sql
├── queries/                              # Representative production sample queries
│   └── sample_queries.sql
├── tests/                                # Automated integrity & constraint test suite
│   └── run_tests.php
├── migrate.php                           # Standalone idempotent PHP migration runner
├── schema.sql                            # Canonical unified database DDL snapshot
└── README.md                             # This documentation file
```

---

## 2. Environment Configuration

Default development database credentials (configured in `.env` and `compose.yaml`):

```dotenv
DB_HOST=mysql
DB_PORT=3306
DB_NAME=toothcare_hub
DB_USER=toothcare_user
DB_PASSWORD=toothcare_secure_pass
DB_ROOT_PASSWORD=root_secure_pass
```

---

## 3. Running Migrations

### A. Automatic Container Initialization
When the Docker Compose stack is booted from an empty volume, `toothcare-mysql` mounts `./database/migrations` into `/docker-entrypoint-initdb.d:ro`, automatically applying all 14 migrations in alphanumeric order.

### B. Using the PHP Migration Runner (`database/migrate.php`)
ToothCare Hub includes an idempotent migration runner that tracks executed migrations in the `schema_migrations` table:

```bash
# Apply pending migrations
php database/migrate.php

# Or via Docker PHP container
Get-Content database/migrate.php -Raw | docker exec -i toothcare-php-fpm php

# Check migration status
php database/migrate.php --status
```

### C. Direct MySQL Schema Import
To recreate the entire schema from the canonical DDL dump in a single command:

```bash
docker exec -i toothcare-mysql mysql -u toothcare_user -ptoothcare_secure_pass toothcare_hub < database/schema.sql
```

---

## 4. Loading Development Seed Data

The development seed dataset (`database/seeds/development_seed.sql`) populates realistic, synthetic data with zero real patient information:
- 1 Clinic Admin (`admin@toothcare.local`)
- 1 Receptionist (`receptionist@toothcare.local`)
- 3 Licensed Dentists (`dr.santos@toothcare.local`, etc.)
- 4 Patient Accounts (`patient.juan@example.com`, etc.)
- 5 Standard Dental Services
- 19 Weekly Dentist Work Shifts
- 4 Sample Appointments in all states (`CONFIRMED`, `COMPLETED`, `CANCELLED`, `PENDING`)
- Complete Status History Audit Trails
- Sample Treatment Records, Notifications, and Outbox Records

To load seed data:

```bash
Get-Content database/seeds/development_seed.sql -Raw | docker exec -i toothcare-mysql mysql -u toothcare_user -ptoothcare_secure_pass toothcare_hub
```

> [!CAUTION]
> **Never load development seeds in a production environment.** The seed script truncates/populates development test accounts and resets sequence auto-increments.

---

## 5. Automated Integrity Test Suite

ToothCare Hub includes an automated test runner (`database/tests/run_tests.php`) that executes 13 assertions verifying:
1. All 14 tables use InnoDB and `utf8mb4_unicode_ci`.
2. Foreign key rejections for invalid references.
3. Unique constraint enforcement (duplicate email, duplicate PRC license).
4. CHECK constraints (`start_at < end_at`, `price >= 0`, `duration > 0`).
5. Overlap detection formula (`start_at < req_end AND end_at > req_start`).
6. Adjacent slot boundaries (`[end_A == start_B]` permitted without conflict).
7. Cancelled appointments release slots immediately.
8. Audit trails and chronological status transitions.

To run the test suite:

```bash
Get-Content database/tests/run_tests.php -Raw | docker exec -i toothcare-php-fpm php
```

Expected output:
```text
SUMMARY: Passed: 13 | Failed: 0 | Total: 13
```

---

## 6. Overlap Detection & Booking Concurrency Protocol

### Overlap Condition
To detect conflicting appointments for a dentist:
```sql
SELECT id FROM appointments
WHERE dentist_id = :dentist_id
  AND status IN ('PENDING', 'CONFIRMED')
  AND start_at < :requested_end
  AND end_at   > :requested_start
LIMIT 1;
```

### Concurrency Strategy
1. `START TRANSACTION;`
2. **Pessimistic Dentist Row Lock:** `SELECT id FROM dentists WHERE id = :dentist_id FOR UPDATE;`
3. Validate dentist active status, working schedule (`dentist_schedules`), and approved time-off (`dentist_time_off`).
4. Execute covering index overlap check (`idx_appointments_overlap`).
5. If conflict found: `ROLLBACK;` and return HTTP `409 Conflict`.
6. If free: `INSERT INTO appointments (...)` and record transition in `appointment_status_history`.
7. `COMMIT;` (Releases locks).

See [concurrency-and-locking.md](file:///c:/xampp/htdocs/GitHub_Clone_File_Projects/ToothCare-Hub/docs/phase-4/concurrency-and-locking.md) for full architectural documentation.

---

## 7. Migration Rollback and Disaster Recovery

### MySQL DDL Rollback Reality
In MySQL (including MySQL 8.0), **DDL statements cause an implicit commit**. A `CREATE TABLE`, `ALTER TABLE`, or `DROP TABLE` statement cannot be rolled back via SQL `ROLLBACK` within a transaction.

### Recovery Strategy:
1. **Always backup before schema modifications:**
   ```bash
   docker exec toothcare-mysql mysqldump -u toothcare_user -ptoothcare_secure_pass --no-tablespaces toothcare_hub > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
   ```
2. **Restoration Procedure:**
   ```bash
   docker exec -i toothcare-mysql mysql -u toothcare_user -ptoothcare_secure_pass toothcare_hub < backup_pre_migration_YYYYMMDD_HHMMSS.sql
   ```
3. **Destructive Changes:** Adding columns or indexes is non-destructive. Dropping columns or renaming tables requires a dual-write phased migration or explicit downtime window.
