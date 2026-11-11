# ToothCare Hub — Complete Database Data Dictionary (30 Tables)

This data dictionary defines all 30 relational database tables within `toothcare_hub`, categorized by functional module.

---

## 1. Authentication & RBAC

### 1.1 `users`
Core identity table representing all system accounts.
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Auto | Unique user identifier |
| `email` | VARCHAR(255) | NO | UNI | | Primary email address for login |
| `password_hash` | VARCHAR(255) | NO | | | Argon2id / Bcrypt password hash |
| `role` | ENUM | NO | MUL | | Legacy primary role (`ADMIN`, `DENTIST`, `PATIENT`) |
| `is_active` | TINYINT(1) | NO | | 1 | Account activation status (0=disabled, 1=active) |
| `email_verified` | TINYINT(1) | NO | | 0 | Verification flag |
| `email_verified_at`| DATETIME | YES | | NULL | Verification timestamp |
| `created_at` | DATETIME | NO | MUL | CURRENT_TIMESTAMP | Registration timestamp |
| `updated_at` | DATETIME | NO | | CURRENT_TIMESTAMP | Last modification timestamp |

### 1.2 `roles`
System and custom administrative roles.
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Auto | Unique role ID |
| `name` | VARCHAR(50) | NO | | | Display name (e.g., "Administrator") |
| `slug` | VARCHAR(50) | NO | UNI | | URL-safe identifier (`admin`, `dentist`, `patient`) |
| `description` | VARCHAR(255) | YES | | NULL | Role scope and responsibilities |
| `is_system` | TINYINT(1) | NO | | 1 | System role protection flag |

### 1.3 `permissions`
Granular application authorization privileges.
| Column | Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Auto | Unique permission ID |
| `name` | VARCHAR(100) | NO | | | Permission label |
| `slug` | VARCHAR(100) | NO | UNI | | Machine key (`appointments.create`, `records.view`) |
| `module` | VARCHAR(50) | NO | MUL | | Functional group (e.g., `appointments`, `clinical`) |

### 1.4 `user_roles`
M:N mapping between users and assigned roles.
| Column | Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Unique mapping ID |
| `user_id` | BIGINT UNSIGNED | NO | FK | References `users(id)` ON DELETE CASCADE |
| `role_id` | BIGINT UNSIGNED | NO | FK | References `roles(id)` ON DELETE CASCADE |

### 1.5 `role_permissions`
M:N mapping assigning permissions to roles.
| Column | Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Unique mapping ID |
| `role_id` | BIGINT UNSIGNED | NO | FK | References `roles(id)` ON DELETE CASCADE |
| `permission_id` | BIGINT UNSIGNED | NO | FK | References `permissions(id)` ON DELETE CASCADE |

### 1.6 `email_verification_tokens`
Specialized token ledger for email confirmation.
| Column | Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Token ID |
| `user_id` | BIGINT UNSIGNED | NO | FK | References `users(id)` ON DELETE CASCADE |
| `token_hash` | VARCHAR(255) | NO | UNI | SHA-256 token digest |
| `expires_at` | DATETIME | NO | | Expiration timestamp |
| `consumed_at`| DATETIME | YES | | Usage timestamp |

### 1.7 `password_reset_tokens`
Specialized token ledger for password reset workflows.
| Column | Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Token ID |
| `user_id` | BIGINT UNSIGNED | NO | FK | References `users(id)` ON DELETE CASCADE |
| `token_hash` | VARCHAR(255) | NO | UNI | SHA-256 token digest |
| `expires_at` | DATETIME | NO | | Expiration timestamp |
| `consumed_at`| DATETIME | YES | | Usage timestamp |

### 1.8 `auth_tokens`
General authorization token ledger supporting multi-purpose auth events.

---

## 2. Clinic Management

### 2.1 `patients`
Demographic and medical safety profiles for patients.
| Column | Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Patient profile identifier |
| `user_id` | BIGINT UNSIGNED | NO | FK,UNI | 1:1 Reference to `users(id)` ON DELETE CASCADE |
| `first_name` | VARCHAR(100) | NO | | Legal given name |
| `last_name` | VARCHAR(100) | NO | | Family name |
| `date_of_birth` | DATE | NO | | Birth date |
| `phone` | VARCHAR(30) | NO | | Primary contact number |
| `medical_alerts`| TEXT | YES | | Allergies and contraindications (e.g. Penicillin) |

### 2.2 `dentists`
Practitioner profiles, licenses, and operatory chair allocations.
| Column | Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Dentist profile identifier |
| `user_id` | BIGINT UNSIGNED | NO | FK,UNI | 1:1 Reference to `users(id)` ON DELETE CASCADE |
| `first_name` | VARCHAR(100) | NO | | Given name |
| `last_name` | VARCHAR(100) | NO | | Family name |
| `specialization`| VARCHAR(150) | NO | | Clinical discipline |
| `license_number`| VARCHAR(50) | NO | UNI | Professional Regulatory Commission license |
| `default_operatory_chair` | VARCHAR(50) | YES | | Default treatment room/chair |

### 2.3 `services`
Dental treatment catalog, standard durations, and pricing.
| Column | Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Service identifier |
| `name` | VARCHAR(150) | NO | | Procedure name |
| `category` | VARCHAR(100) | NO | | Clinical category (Preventive, Restorative, etc.) |
| `price` | DECIMAL(10,2) | NO | | Standard fee in PHP |
| `duration_minutes` | SMALLINT | NO | | Slot length required |
| `is_active` | TINYINT(1) | NO | | Availability flag |

### 2.4 `dentist_services`
M:N mapping connecting dentists to specific dental services they perform.

---

## 3. Scheduling & Availability

### 3.1 `dentist_schedules`
Weekly recurring shift allocations.
### 3.2 `dentist_schedule_exceptions`
Date-specific hours adjustments or temporary operatory reallocations.
### 3.3 `dentist_time_off`
Planned clinician leave, approved conferences, and medical absences.
### 3.4 `clinic_operating_hours`
Facility-wide opening and closing hours per day of the week.
### 3.5 `clinic_closures`
Facility-wide holiday closures, maintenance shutdowns, and emergency closures.

---

## 4. Appointments Module

### 4.1 `appointments`
Primary appointment booking entity.
### 4.2 `appointment_statuses`
Lookup table defining authoritative statuses (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`), labels, hex colors, and terminal markers.
### 4.3 `appointment_status_history`
Append-only audit trail recording every state change, actor, and rationale.

---

## 5. Clinical Documentation

### 5.1 `treatment_records`
Official clinical records containing FDI tooth notation (ISO 3950), diagnosis, procedure notes, prescription notes, home care advice, and 24-hour compliance lock.
### 5.2 `treatment_record_versions`
Immutable version snapshots created whenever clinical notes are amended.

---

## 6. Notifications & Outbox

### 6.1 `notifications`
In-app notification records for patients and clinic staff.
### 6.2 `email_outbox`
Transactional email queue processed asynchronously by background worker.
### 6.3 `outbox`
Generic transactional outbox for domain event streaming.

---

## 7. Security, Auditing & Configuration

### 7.1 `audit_logs`
HIPAA-compliant forensic audit logs recording all user and admin actions.
### 7.2 `security_events`
Authentication telemetry tracking logins, lockouts, and token events.
### 7.3 `rate_limits`
Sliding-window IP and account rate limiter buckets.
### 7.4 `clinic_settings`
Dynamic key-value system settings store.
### 7.5 `schema_migrations`
Sequential migration ledger with batch tracking and execution timings.
