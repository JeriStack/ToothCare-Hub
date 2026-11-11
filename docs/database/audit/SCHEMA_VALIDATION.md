# ToothCare Hub — Database Schema Validation Report

**Database:** `toothcare_hub`  
**Engine:** MySQL 8.0 (Community Edition)  
**Storage Engine:** `InnoDB`  
**Character Set & Collation:** `utf8mb4` / `utf8mb4_unicode_ci`  
**Audit Timestamp:** 2026-11-11 02:30:00 (Asia/Manila)  
**Total Tables Audited:** 30 / 30

---

## 1. Schema Inventory & Module Mapping

Every table in the `toothcare_hub` database was inspected against the architectural requirements.

| # | Table Name | Storage Engine | Collation | Module Category | Primary Key | Total Columns | Status |
|---|---|---|---|---|---|---|---|
| 1 | `schema_migrations` | InnoDB | utf8mb4_unicode_ci | System Ledger | `id` (BIGINT) | 5 | Verified |
| 2 | `users` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 9 | Verified |
| 3 | `roles` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 7 | Verified |
| 4 | `permissions` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 6 | Verified |
| 5 | `user_roles` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 4 | Verified |
| 6 | `role_permissions` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 4 | Verified |
| 7 | `email_verification_tokens` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 6 | Verified |
| 8 | `password_reset_tokens` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 6 | Verified |
| 9 | `auth_tokens` | InnoDB | utf8mb4_unicode_ci | Auth & RBAC | `id` (BIGINT) | 7 | Verified |
| 10 | `patients` | InnoDB | utf8mb4_unicode_ci | Clinic Management | `id` (BIGINT) | 12 | Verified |
| 11 | `dentists` | InnoDB | utf8mb4_unicode_ci | Clinic Management | `id` (BIGINT) | 12 | Verified |
| 12 | `services` | InnoDB | utf8mb4_unicode_ci | Clinic Management | `id` (BIGINT) | 9 | Verified |
| 13 | `dentist_services` | InnoDB | utf8mb4_unicode_ci | Clinic Management | `id` (BIGINT) | 6 | Verified |
| 14 | `dentist_schedules` | InnoDB | utf8mb4_unicode_ci | Scheduling | `id` (BIGINT) | 8 | Verified |
| 15 | `dentist_schedule_exceptions`| InnoDB | utf8mb4_unicode_ci | Scheduling | `id` (BIGINT) | 8 | Verified |
| 16 | `dentist_time_off` | InnoDB | utf8mb4_unicode_ci | Scheduling | `id` (BIGINT) | 8 | Verified |
| 17 | `clinic_operating_hours` | InnoDB | utf8mb4_unicode_ci | Scheduling | `id` (BIGINT) | 7 | Verified |
| 18 | `clinic_closures` | InnoDB | utf8mb4_unicode_ci | Scheduling | `id` (BIGINT) | 9 | Verified |
| 19 | `appointments` | InnoDB | utf8mb4_unicode_ci | Appointments | `id` (BIGINT) | 19 | Verified |
| 20 | `appointment_statuses` | InnoDB | utf8mb4_unicode_ci | Appointments | `id` (BIGINT) | 8 | Verified |
| 21 | `appointment_status_history` | InnoDB | utf8mb4_unicode_ci | Appointments | `id` (BIGINT) | 8 | Verified |
| 22 | `treatment_records` | InnoDB | utf8mb4_unicode_ci | Clinical Documentation | `id` (BIGINT) | 12 | Verified |
| 23 | `treatment_record_versions` | InnoDB | utf8mb4_unicode_ci | Clinical Documentation | `id` (BIGINT) | 12 | Verified |
| 24 | `notifications` | InnoDB | utf8mb4_unicode_ci | Notifications | `id` (BIGINT) | 10 | Verified |
| 25 | `email_outbox` | InnoDB | utf8mb4_unicode_ci | Notifications | `id` (BIGINT) | 13 | Verified |
| 26 | `outbox` | InnoDB | utf8mb4_unicode_ci | Notifications | `id` (BIGINT) | 11 | Verified |
| 27 | `audit_logs` | InnoDB | utf8mb4_unicode_ci | Security & Auditing | `id` (BIGINT) | 9 | Verified |
| 28 | `security_events` | InnoDB | utf8mb4_unicode_ci | Security & Auditing | `id` (BIGINT) | 7 | Verified |
| 29 | `rate_limits` | InnoDB | utf8mb4_unicode_ci | Security & Auditing | `id` (BIGINT) | 6 | Verified |
| 30 | `clinic_settings` | InnoDB | utf8mb4_unicode_ci | Configuration | `id` (BIGINT) | 8 | Verified |

---

## 2. DDL Integrity & Constraints Verification

### 2.1 Primary Keys
- **100% Compliance**: All 30 tables define a surrogate `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`.
- No composite primary keys exist, ensuring predictable foreign key indexing and consistent ORM/repository mapping.

### 2.2 Unique Constraints
The following unique constraints were verified in `information_schema.TABLE_CONSTRAINTS`:
1. `users.email` (`uq_users_email`): Prevents duplicate account registrations.
2. `patients.user_id` (`uq_patients_user_id`): Enforces strict 1:1 user-to-patient relationship.
3. `dentists.user_id` (`uq_dentists_user_id`): Enforces strict 1:1 user-to-dentist relationship.
4. `dentists.license_number` (`uq_dentists_license_number`): Guarantees professional PRC license uniqueness.
5. `services.name` (`uq_services_name`): Prevents duplicate service nomenclature.
6. `dentist_services (dentist_id, service_id)` (`uq_dentist_services`): Prevents duplicate clinician-to-procedure mappings.
7. `treatment_records.appointment_id` (`uq_treatment_records_appointment`): Enforces strict 1:1 appointment-to-clinical-record cardinality.
8. `treatment_record_versions (treatment_record_id, version_number)` (`uq_record_version`): Guarantees sequential version uniqueness per record.
9. `appointment_statuses.status_code` (`uq_appointment_statuses_code`): Canonical state uniqueness.
10. `roles.slug` (`uq_roles_slug`): Enforces unique role slugs.
11. `permissions.slug` (`uq_permissions_slug`): Enforces unique privilege slugs.
12. `user_roles (user_id, role_id)` (`uq_user_roles`): Prevents duplicate role grants.
13. `role_permissions (role_id, permission_id)` (`uq_role_permissions`): Prevents duplicate permission grants.
14. `clinic_settings.setting_key` (`uq_clinic_settings_key`): Prevents duplicate setting parameters.
15. `rate_limits.rate_key` (`uq_rate_limits_key`): Enforces atomic sliding-window rate limit counters.
16. `auth_tokens.token_hash` (`uq_auth_tokens_hash`): Guarantees cryptographic token uniqueness.
17. `email_verification_tokens.token_hash` (`uq_verify_token_hash`): Token digest uniqueness.
18. `password_reset_tokens.token_hash` (`uq_reset_token_hash`): Token digest uniqueness.
19. `schema_migrations.version` (`version`): Prevents migration duplicate execution.

### 2.3 CHECK Constraints
MySQL 8.0 natively enforces all 11 defined check constraints:
- `chk_services_price`: `price >= 0.00`
- `chk_services_duration`: `duration_minutes IN (15, 30, 45, 60, 90, 120)`
- `chk_dentist_schedules_day`: `day_of_week BETWEEN 1 AND 7`
- `chk_dentist_schedules_time`: `start_time < end_time`
- `chk_time_off_interval`: `start_at < end_at`
- `chk_appointments_interval`: `start_at < end_at`
- `chk_appointments_price`: `price_snapshot >= 0.00`
- `chk_clinic_hours_day`: `day_of_week BETWEEN 1 AND 7`
- `chk_clinic_hours_interval`: `is_closed = 1 OR opening_time < closing_time`
- `chk_closures_interval`: `start_at < end_at`
- `chk_schedule_exceptions_interval`: `is_unavailable = 1 OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)`

---

## 3. Data Types and Precision
- **Financial values**: Stored as `DECIMAL(10,2)` in `services.price` and `appointments.price_snapshot`. Never stored as floating-point.
- **Timestamps**: Stored as `DATETIME` across all clinical and operational entities.
- **Clinical Teeth Notation**: Stored as native `JSON` array in `treatment_records.teeth_treated` and `treatment_record_versions.teeth_treated`, adhering to FDI Two-Digit Notation (ISO 3950).
- **Audit Payloads**: Stored as native `JSON` in `audit_logs.sanitized_payload` and `security_events.metadata`.

---

## 4. Findings & Deviations
1. **Finding SCH-01 (Informational)**: Two concurrent token persistence patterns exist: unified `auth_tokens` and specialized `email_verification_tokens` / `password_reset_tokens`. Both are valid InnoDB tables. Backend repositories currently write to `auth_tokens`.
2. **Finding SCH-02 (Informational)**: `appointments.status` is stored as an `ENUM('PENDING','CONFIRMED','REJECTED','CANCELLED','COMPLETED')` on `appointments`, while `appointment_statuses` provides a metadata lookup table for UI badges and labels. Both are synchronized.
