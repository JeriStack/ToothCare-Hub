# ToothCare Hub — Database Schema Validation & Test Results
**Document Version:** 1.0.0  
**Phase:** Phase 4 — Database Modeling and Versioned Schema  
**Execution Timestamp:** 2026-10-28 00:05:36 (UTC+08:00)  
**Database Server:** MySQL 8.0.46 (InnoDB Engine, `utf8mb4_unicode_ci` Collation)  
**Test Suite Script:** `database/tests/run_tests.php`  
**Result Status:** **ALL 13 TESTS PASSED (100% SUCCESS RATE)**  

---

## 1. Test Suite Summary Matrix

| # | Test Assertion Description | Constraint / Target | Expected Behavior | Actual MySQL Response | Status |
| :-: | :--- | :--- | :--- | :--- | :-: |
| **01** | All 14 core & support tables exist with InnoDB & utf8mb4 | `information_schema.tables` | 14 tables found with `ENGINE=InnoDB` and `utf8mb4_unicode_ci` | All 14 tables matched specifications | **PASS** |
| **02** | Foreign Key rejection on invalid `patient_id` in appointments | `fk_appointments_patient` | Reject insert with MySQL error `1452` | Error `1452` (Cannot add child row: FK fails) | **PASS** |
| **03** | Foreign Key rejection on invalid `user_id` in patients | `fk_patients_user_id` | Reject insert with MySQL error `1452` | Error `1452` (Cannot add child row: FK fails) | **PASS** |
| **04** | Unique constraint enforcement on duplicate user email | `uq_users_email` | Reject duplicate email with MySQL error `1062` | Error `1062` (Duplicate entry 'admin@toothcare.local') | **PASS** |
| **05** | Unique constraint on duplicate dentist license | `uq_dentists_license_number` | Reject duplicate PRC number with MySQL error `1062` | Error `1062` (Duplicate entry 'PRC-008472') | **PASS** |
| **06** | CHECK constraint rejection when `start_at >= end_at` | `chk_appointments_interval` | Reject inverted datetime interval with error `3819` | Error `3819` (`chk_appointments_interval` violated) | **PASS** |
| **07** | CHECK constraint rejection when service price is negative | `chk_services_price` | Reject negative decimal price with error `3819` | Error `3819` (`chk_services_price` violated) | **PASS** |
| **08** | CHECK constraint rejection when service duration is 0 | `chk_services_duration` | Reject duration `<= 0` with error `3819` | Error `3819` (`chk_services_duration` violated) | **PASS** |
| **09** | Canonical Overlap Formula: Detects partial overlap | Interval condition | Detect conflict with existing CONFIRMED booking `1042` | Exactly 1 conflicting row returned (`id = 1042`) | **PASS** |
| **10** | Canonical Overlap Formula: Detects full enclosure | Interval condition | Detect conflict when requested slot envelops existing | Exactly 1 conflicting row returned (`id = 1042`) | **PASS** |
| **11** | Adjacent Slot Handling: Permits contiguous bookings | `[end_A == start_B]` | Permit adjacent slots before/after without false conflict | Exactly 0 conflicts returned for both slots | **PASS** |
| **12** | Status Blocking Policy: CANCELLED releases slot | Status filter | Overlap check ignores CANCELLED appointments | Exactly 0 conflicts returned on cancelled slot | **PASS** |
| **13** | Audit Trail: Chronological status transition history | `appointment_status_history` | Preserves state transitions with actor and timestamp | $\ge 2$ historical transitions found for `1042` | **PASS** |

---

## 2. Live Test Suite Execution Log

The test suite was executed against the active MySQL 8.0 container (`toothcare-mysql`):

```text
====================================================================
ToothCare Hub — Phase 4 Database Validation Test Suite
Database: toothcare_hub | Server: MySQL 8.0 (InnoDB)
====================================================================

• Testing: All 14 core & support tables exist with InnoDB & utf8mb4 ... [PASS]
• Testing: Foreign Key rejection on inserting appointment with non-existent patient ... [PASS]
• Testing: Foreign Key rejection on inserting patient with non-existent user_id ... [PASS]
• Testing: Unique constraint enforcement on duplicate email (uq_users_email) ... [PASS]
• Testing: Unique constraint enforcement on duplicate dentist license (uq_dentists_license_number) ... [PASS]
• Testing: CHECK constraint rejection when start_at >= end_at (chk_appointments_interval) ... [PASS]
• Testing: CHECK constraint rejection when service price is negative (chk_services_price) ... [PASS]
• Testing: CHECK constraint rejection when service duration is 0 or > 480 (chk_services_duration) ... [PASS]
• Testing: Interval Overlap Formula: Detects partial overlap with CONFIRMED appointment ... [PASS]
• Testing: Interval Overlap Formula: Detects full enclosure where requested slot envelops existing ... [PASS]
• Testing: Interval Overlap Formula: Permits adjacent slots [end_A == start_B] without false conflict ... [PASS]
• Testing: Status Blocking Policy: CANCELLED appointments do not block time slots ... [PASS]
• Testing: Audit Trail: Status history preserves chronological transitions for appointments ... [PASS]

====================================================================
SUMMARY: Passed: 13 | Failed: 0 | Total: 13
====================================================================
```

---

## 3. Empty Database Recreation Test

To verify reproducibility from a clean state without manual interventions:
1. Created clean database `toothcare_hub_test`.
2. Applied migrations `001_create_schema_migrations.sql` through `014_create_audit_logs.sql` in sequential dependency order.
3. Queried `information_schema.tables`:
   ```text
   appointment_status_history
   appointments
   audit_logs
   auth_tokens
   dentist_schedules
   dentist_time_off
   dentists
   email_outbox
   notifications
   patients
   schema_migrations
   services
   treatment_records
   users
   ```
4. Verified all 14 tables created without warnings or syntax errors.
5. Dropped temporary test database `toothcare_hub_test`.

---

## 4. Migration Runner Idempotency Test

Executed `php database/migrate.php` against the fully migrated database `toothcare_hub`:

```text
========================================================
ToothCare Hub — Migration Runner
Target Database: toothcare_hub on mysql:3306
========================================================
[INFO] No pending migrations. Database schema is fully up to date!
```

**Verification:** Re-running the migration runner does not re-apply existing migrations or cause duplicate table/index errors.

---

## 5. Seed Dataset Verification

Verified that synthetic seed records populated all tables properly without orphan references:

| Table | Row Count | Seed Verification Notes |
| :--- | :---: | :--- |
| `schema_migrations` | **14** | All 14 migrations registered in Batch #1. |
| `users` | **9** | 1 Admin, 1 Receptionist, 3 Dentists, 4 Patients. |
| `patients` | **4** | 1:1 linked with user accounts, valid demographic data. |
| `dentists` | **3** | Dr. Maria Santos, Dr. Roberto Reyes, Dr. Alyssa Chen. |
| `services` | **5** | Diagnostic, Preventive, Restorative, Endodontic, Surgical. |
| `dentist_schedules` | **19** | Weekly morning and afternoon shifts across 6 working days. |
| `dentist_time_off` | **1** | Approved medical leave for Dr. Roberto Reyes. |
| `appointments` | **4** | Includes COMPLETED, CONFIRMED, CANCELLED, and PENDING. |
| `appointment_status_history` | **9** | Complete chronological audit transitions. |
| `treatment_records` | **1** | Completed cleaning record with clinical and prescription notes. |
| `notifications` | **3** | Unread and read notifications across roles. |
| `email_outbox` | **2** | Pending and sent asynchronous notifications. |
| `auth_tokens` | **2** | Email verification and password reset hashed tokens. |
| `audit_logs` | **3** | Security and administrative audit trail. |

---

## 6. Conclusion

The Phase 4 database implementation complies with all constraints, relational integrity rules, interval overlap requirements, and indexing plans. All tests passed with verified evidence from the live MySQL 8.0 environment.
