# ToothCare Hub — Prioritized Remediation Plan

This document provides actionable, evidence-based recommendations categorized by risk level and implementation priority following the database audit.

---

## 1. Prioritized Findings Summary

| ID | Category | Severity | Description | Risk | Target Component |
|---|---|---|---|---|---|
| **DOC-01** | Infrastructure | LOW | False "unhealthy" status on `email-worker` and `db-backup` | Low | `compose.yaml` |
| **TR-01** | Clinical | MEDIUM | Record version snapshot not written upon amendment in `TreatmentRecordService` | Low | `TreatmentRecordService.php` |
| **REL-01** | Referential | LOW | Cross-table ownership consistency enforced only at app layer | Low | DDL Schema (`appointments`, `treatment_records`) |
| **RBAC-01**| Security | LOW | Fine-grained permissions tables not yet checked in route middleware | Low | `AuthorizationMiddleware.php` |
| **PERF-01**| Performance | INFORMATIONAL | Repository pagination upper boundary guard | Negligible | Repositories |

---

## 2. Detailed Remediation Procedures

### Fix 1 (DOC-01): Correct Docker Healthchecks for CLI Daemons
- **Problem**: `email-worker` and `db-backup` inherit the PHP-FPM socket check from `toothcare-php-fpm`, which expects port 9000 to listen. Because they run CLI scripts, Docker marks them `unhealthy`.
- **Correction**: In `compose.yaml`, override the healthcheck for both services:
  ```yaml
  email-worker:
    healthcheck:
      test: ["CMD-SHELL", "ps aux | grep -v grep | grep ProcessEmailOutbox.php || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
  db-backup:
    healthcheck:
      disable: true
  ```
- **Verification**: Run `docker compose ps` and confirm both services report `Up` without `(unhealthy)`.

---

### Fix 2 (TR-01): Connect Treatment Record Version Snapshots
- **Problem**: When an authoring dentist amends a treatment record within the 24-hour compliance window, `TreatmentRecordService::updateRecord()` updates `treatment_records` in place, but does not yet create a version row in `treatment_record_versions`.
- **Correction**:
  1. Add `recordVersion()` in `TreatmentRecordRepository`:
     ```php
     public function recordVersion(int $recordId, array $currentData, string $reason, int $userId, ?PDO $pdo = null): int {
         // Query max version_number for this record
         // Insert into treatment_record_versions
     }
     ```
  2. In `TreatmentRecordService::updateRecord()`, call `recordVersion()` within the active transaction before executing `update()`.
- **Verification**: Run tests updating an existing record and verify `treatment_record_versions` row count increments.

---

### Fix 3 (REL-01): Composite Foreign Key for Clinical Ownership
- **Problem**: While `TreatmentRecordService` strictly sources `patient_id` and `dentist_id` from the appointment row in PHP, the MySQL DDL has separate single-column foreign keys.
- **Correction**:
  Create migration `023_add_appointment_composite_ownership.sql`:
  ```sql
  ALTER TABLE appointments ADD CONSTRAINT uq_appointments_ownership UNIQUE (id, dentist_id, patient_id);
  ALTER TABLE treatment_records ADD CONSTRAINT fk_treatment_records_ownership 
    FOREIGN KEY (appointment_id, dentist_id, patient_id) 
    REFERENCES appointments(id, dentist_id, patient_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE;
  ```
- **Verification**: Attempt to insert a treatment record with mismatched patient/dentist IDs directly in MySQL; verify Error 1452 rejection.

---

### Fix 4 (RBAC-01): Connect Fine-Grained Permissions Guard
- **Problem**: The system relies on coarse `users.role` ENUM (`ADMIN`, `DENTIST`, `PATIENT`). The enterprise RBAC tables (`roles`, `permissions`, `role_permissions`, `user_roles`) are populated but not evaluated in route guards.
- **Correction**: Add `PermissionMiddleware::can('treatment_records.amend')` to query `user_roles` and `role_permissions` with in-memory caching.
