# ToothCare Hub — History Records & Archive Management System

## 1. Architectural Separation of Concerns

ToothCare Hub separates historical visibility and record lifecycle governance into **three distinct, interconnected modules** backed by shared append-only storage (`audit_logs`, `appointment_status_history`, `archive_records`, `archive_history`):

1. **History Records (`/admin/history`, `/api/v1/history*`)**
   - Chronological lifecycle tracking of individual accounts (Patients, Dentists, Receptionists, Administrators), Appointments, and system activities.
   - Displays all timestamps in `Asia/Manila` (PHT), preserves actor identity even after an actor is archived, and computes structured **Previous → Updated** value comparisons while redacting passwords, tokens, and complete clinical notes.
2. **Audit Trail (`/admin/audit`, `/api/v1/admin/audit-logs*`)**
   - Append-only forensic accountability stream and security event feed for administrators (`audit_logs.view`, `audit_logs.export`).
3. **Archive Management (`/admin/archives`, `/receptionist/archives`, `/dentist/archives`, `/patient/archives`, `/api/v1/archives*`)**
   - Non-destructive archival and restoration workflow with tamper-evident SHA-256 snapshots, account category views (Patient, Dentist, Receptionist, Administrator Archives), unresolved appointment guards, active session/token revocation, immutable clinical retention locks (`LOCKED_RETENTION`), and multi-cycle archival/restoration ledgers (`archive_history`).

---

## 2. Database Schema & Performance Indexes

- **Reused Tables (no duplicate infrastructure):**
  - `audit_logs` (extended with composite indexes `idx_audit_logs_actor_created` and `idx_audit_logs_target_entity` in migration `037`)
  - `appointment_status_history` (existing appointment status transition log)
  - `treatment_record_versions` (dedicated clinical record versioning — general audit logs never duplicate full clinical notes)
  - `users`, `patients`, `dentists`, `appointments`, `auth_tokens`, `realtime_tickets`, `realtime_outbox`
- **Archive Tables (Migrations `036` & `037`):**
  - `archive_records`: tamper-evident snapshot storage with `account_type` (`PATIENT | DENTIST | RECEPTIONIST | ADMIN`), `archived_email`, `status` (`ARCHIVED | RESTORED | LOCKED_RETENTION`), `retention_category`, `snapshot_sha256`, and `is_example` flag.
  - `archive_history`: append-only multi-cycle ledger recording every `ARCHIVED`, `RESTORED`, and `REARCHIVED` transition with `ON DELETE RESTRICT` foreign key to `archive_records` and `ON DELETE SET NULL` actor reference.

---

## 3. DRBAC Permission Matrix

| Permission Slug | Module | Admin | Receptionist | Dentist | Patient | Server-Side Ownership Scope |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `history.view` | `history` | Yes | Yes | Yes | Yes | Admin: all; Receptionist: operational; Dentist/Patient: own + assigned |
| `history.view_details` | `history` | Yes | Yes | Yes | Yes | Object-level ownership checked per event |
| `history.view_patient` | `history` | Yes | Yes | Assigned only | Self only | Patients strictly isolated to own ID |
| `history.view_staff` | `history` | Yes | Self only | Self only | No | Prevents cross-staff inspection |
| `history.view_appointment` | `history` | Yes | Yes | Assigned only | Own only | Verifies `patient_id` or `dentist_id` |
| `archives.view` | `archives` | Yes | Operational | Own clinical | Own only | Role + ownership SQL predicates |
| `archives.create` | `archives` | Yes | Resolved appts | Own clinical/appts | No | Enforces pre-archival safeguards |
| `archives.restore` | `archives` | Yes | No | No | No | Separation of duties; blocks `LOCKED_RETENTION` & examples |
| `archives.export` | `archives` | Yes | Yes | No | No | Formula-neutralized CSV up to 5,000 rows |
| `archives.view_history` | `archives` | Yes | Operational | Own clinical | Own only | Multi-cycle `archive_history` timeline |

---

## 4. Archival & Restoration Operational Safeguards

- **Patient Archival:** Detects unresolved `PENDING` / `CONFIRMED` appointments and blocks archival (`409 UNRESOLVED_APPOINTMENTS_EXIST`) with the list of blocking appointments so staff resolve or cancel them explicitly. Never silently cancels or deletes appointments.
- **Dentist Archival:** Detects unresolved `PENDING` / `CONFIRMED` assigned appointments and blocks archival (`409 UNRESOLVED_APPOINTMENTS_EXIST`) until reassigned or resolved. Preserves original dentist attribution in historical records.
- **Receptionist & Administrator Archival:** Deactivates account login (`users.is_active = 0`, rejected immediately by `AuthenticationMiddleware`), invalidates outstanding `auth_tokens` and `realtime_tickets`, records `SESSION_REVOKED`, blocks self-archival (`409 SELF_ARCHIVE_BLOCKED`), and blocks archiving the last active Administrator (`409 LAST_ADMIN_PROTECTED`).
- **Restoration:** Requires explicit confirmation and mandatory reason, validates underlying record existence and email uniqueness (`409 EMAIL_CONFLICT_ON_RESTORE`), appends a `RESTORED` cycle to `archive_history` without overwriting prior archival history, never automatically restores old sessions/tokens, and returns `review_notices` prompting permission and schedule review.

---

## 5. Privacy, Retention & Legal Notice

- Archiving is **strictly non-destructive**; ToothCare Hub does not perform automatic permanent deletion of archived accounts, appointments, or clinical records.
- General-purpose history payloads redact passwords, tokens, secrets, and complete clinical notes (`diagnosis`, `procedure_notes`, `prescription_notes`, `home_care_advice`, `medical_history`) and minimize IPv4 precision.
- **Governance Disclaimer:** Retention schedules, permanent disposition workflows, and healthcare recordkeeping compliance (including obligations under the **Philippine Data Privacy Act of 2012 (RA 10173)** and applicable DOH/PRC clinical documentation standards) require formal clinic policy approval and qualified legal/privacy review. Implementing these technical controls does not by itself constitute legal compliance certification.

---

## 6. Development, Seeding & Testing

```bash
# Apply additive migrations (036 & 037)
php database/migrate.php --no-backup

# Seed repeatable synthetic development data (safe & idempotent)
php database/scripts/seed-history-and-archives.php

# Verify OpenAPI 3.0.3 parity
php backend/scripts/generate-openapi.php --check
php backend/scripts/validate-openapi.php

# Run backend & frontend test suites
php backend/vendor/bin/phpunit -c backend/phpunit.xml --testsuite Integration
npm --prefix frontend test -- --run --maxWorkers=2
npm --prefix frontend run build
```
