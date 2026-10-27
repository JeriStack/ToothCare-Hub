# ToothCare Hub — Database Data Dictionary

**Document ID:** `TCH-P4-DDC-001`  
**Version:** `1.0.0`  
**Phase:** Phase 4 — Database Modeling and Versioned Schema  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead Database Architect & Security Specialist  

---

## 1. Data Dictionary Overview

This data dictionary documents the complete database schema for **ToothCare Hub** running on MySQL 8.0 with InnoDB and `utf8mb4_unicode_ci`.

### Security & Sensitivity Classification
- **Public:** Publicly viewable catalog information (active dental services, general clinic hours).
- **Internal / Operational:** Operational staff records, schedule shifts, non-clinical appointment summaries.
- **PII (Personally Identifiable Information):** Patient demographics, phone numbers, email addresses, dates of birth. Protected under strict access controls.
- **Sensitive Medical (PHI):** Medical alerts, penicillin allergies, clinical diagnoses, treatment procedures, prescription notes. Restricted exclusively to assigned attending practitioners.
- **Restricted Security:** Password hashes, auth tokens, session revocation logs.

---

## 2. Table Specifications

### 2.1 Table: `schema_migrations`
- **Purpose:** Ledger tracking applied database migrations, batches, and execution timestamps.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique sequential migration record ID |
| `version` | `VARCHAR(255)` | NO | None | UNIQUE | Internal | Unique version identifier (e.g., `001_create_schema_migrations`) |
| `name` | `VARCHAR(255)` | NO | None | None | Internal | Base SQL filename |
| `batch` | `INT UNSIGNED` | NO | `1` | INDEX (`idx_batch`) | Internal | Migration batch execution number |
| `applied_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Execution timestamp in `Asia/Manila` |

---

### 2.2 Table: `users`
- **Purpose:** Central authentication entity, role authorization boundaries, and account active states.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique user identifier |
| `email` | `VARCHAR(255)` | NO | None | UNIQUE (`uq_users_email`) | PII | Lowercase normalized email used as primary login credential |
| `password_hash` | `VARCHAR(255)` | NO | None | None | Restricted | Cryptographic password hash generated via Argon2id |
| `role` | `ENUM('ADMIN', 'DENTIST', 'PATIENT')` | NO | None | INDEX (`idx_users_role_active`) | Internal | Explicit role authorization boundary |
| `is_active` | `TINYINT(1)` | NO | `1` | INDEX (`idx_users_role_active`) | Internal | Account active status (`1=Active`, `0=Deactivated/Suspended`) |
| `email_verified` | `TINYINT(1)` | NO | `0` | None | Internal | Verification flag (`1=Verified`, `0=Unverified`) |
| `email_verified_at`| `DATETIME` | YES | `NULL` | None | Internal | Verification timestamp |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | INDEX (`idx_users_created_at`) | Internal | Account registration timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Last record modification timestamp |

---

### 2.3 Table: `patients`
- **Purpose:** 1:1 patient profile linked to `users`, demographic contact details, and verified medical alerts/allergies.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique patient profile ID |
| `user_id` | `BIGINT UNSIGNED` | NO | None | UNIQUE, FK -> `users(id)` (`RESTRICT`) | Internal | Parent user account reference |
| `first_name` | `VARCHAR(100)` | NO | None | INDEX (`idx_patients_name`) | PII | Patient given name |
| `last_name` | `VARCHAR(100)` | NO | None | INDEX (`idx_patients_name`) | PII | Patient family name |
| `date_of_birth` | `DATE` | NO | None | None | PII | Patient birthdate (must be past date) |
| `phone` | `VARCHAR(30)` | NO | None | INDEX (`idx_patients_phone`) | PII | Mobile phone number (PH format `+639...`) |
| `gender` | `ENUM('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY')` | NO | `'PREFER_NOT_TO_SAY'` | None | PII | Patient gender declaration |
| `address` | `VARCHAR(255)` | YES | `NULL` | None | PII | Residential street address |
| `emergency_contact_name` | `VARCHAR(150)` | YES | `NULL` | None | PII | Next-of-kin or emergency contact full name |
| `emergency_contact_phone`| `VARCHAR(30)` | YES | `NULL` | None | PII | Emergency contact mobile phone |
| `medical_alerts` | `TEXT` | YES | `NULL` | None | Sensitive | Drug allergies (e.g., Penicillin), cardiac conditions, asthma |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Record creation timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Last profile update timestamp |

---

### 2.4 Table: `dentists`
- **Purpose:** 1:1 practitioner profile linked to `users`, dental specialization, license number, and default chair.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique dentist practitioner ID |
| `user_id` | `BIGINT UNSIGNED` | NO | None | UNIQUE, FK -> `users(id)` (`RESTRICT`) | Internal | Parent user account reference |
| `first_name` | `VARCHAR(100)` | NO | None | None | Public | Practitioner given name |
| `last_name` | `VARCHAR(100)` | NO | None | None | Public | Practitioner family name |
| `specialization`| `VARCHAR(150)` | NO | None | INDEX (`idx_dentists_specialization`) | Public | Specialty (General, Orthodontics, Endodontics, Surgery) |
| `license_number`| `VARCHAR(50)` | NO | None | UNIQUE (`uq_dentists_license_number`) | Public | Philippine PRC Dental License number |
| `phone` | `VARCHAR(30)` | NO | None | None | Internal | Direct clinic contact number |
| `default_operatory_chair` | `VARCHAR(50)` | NO | `'Chair 1'` | None | Internal | Default assigned clinic suite/operatory chair |
| `bio` | `TEXT` | YES | `NULL` | None | Public | Professional practitioner biography |
| `is_active` | `TINYINT(1)` | NO | `1` | INDEX (`idx_dentists_active`) | Public | Active clinical practice status (`1=Active`, `0=Inactive`) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Record creation timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Last update timestamp |

---

### 2.5 Table: `services`
- **Purpose:** Catalog of dental procedures, categories, baseline fees in PHP, and standard duration minutes.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique service procedure ID |
| `name` | `VARCHAR(150)` | NO | None | UNIQUE (`uq_services_name`) | Public | Clinical service title |
| `category` | `VARCHAR(100)` | NO | `'General'` | INDEX (`idx_services_category_active`) | Public | Classification (Preventive, Restorative, Cosmetic, Surgery) |
| `description` | `TEXT` | YES | `NULL` | None | Public | Detailed description of the clinical procedure |
| `price` | `DECIMAL(10,2)`| NO | None | CHECK (`price >= 0.00`) | Public | Standard procedure fee in Philippine Pesos (PHP) |
| `duration_minutes` | `INT UNSIGNED` | NO | None | CHECK (`duration_minutes IN (15, 30, 45, 60, 90, 120)`) | Public | Procedure duration driving 30-min slot allocation |
| `is_active` | `TINYINT(1)` | NO | `1` | INDEX (`idx_services_is_active`) | Public | Availability flag for online patient booking |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Catalog entry creation timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Last fee/duration modification timestamp |

---

### 2.6 Table: `dentist_schedules`
- **Purpose:** Recurring weekly working shifts and operatory chair allocations per practitioner.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique shift allocation ID |
| `dentist_id` | `BIGINT UNSIGNED` | NO | None | FK -> `dentists(id)` (`CASCADE`) | Internal | Assigned practitioner reference |
| `day_of_week` | `TINYINT UNSIGNED` | NO | None | CHECK (`1..7`), INDEX (`idx_schedules_dentist_day`) | Internal | Day of week (`1=Monday, 2=Tuesday, ..., 7=Sunday`) |
| `start_time` | `TIME` | NO | None | CHECK (`start_time < end_time`) | Internal | Shift start time (e.g., `09:00:00`) |
| `end_time` | `TIME` | NO | None | None | Internal | Shift end time (e.g., `12:00:00` or `17:00:00`) |
| `operatory_chair`| `VARCHAR(50)`| NO | `'Chair 1'` | None | Internal | Designated operatory chair suite |
| `is_active` | `TINYINT(1)` | NO | `1` | INDEX (`idx_schedules_dentist_day`) | Internal | Shift active toggle |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Shift creation timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Shift modification timestamp |

---

### 2.7 Table: `dentist_time_off`
- **Purpose:** Approved practitioner leaves, vacations, conventions, and emergency blocked clinic hours.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique time-off exception ID |
| `dentist_id` | `BIGINT UNSIGNED` | NO | None | FK -> `dentists(id)` (`CASCADE`), INDEX (`idx_time_off_dentist_interval`) | Internal | Target dentist practitioner |
| `start_at` | `DATETIME` | NO | None | CHECK (`start_at < end_at`), INDEX (`idx_time_off_dentist_interval`) | Internal | Blocked period start in `Asia/Manila` |
| `end_at` | `DATETIME` | NO | None | INDEX (`idx_time_off_dentist_interval`) | Internal | Blocked period end in `Asia/Manila` |
| `reason` | `VARCHAR(255)` | NO | None | None | Internal | Justification for time-off |
| `approved_by_user_id` | `BIGINT UNSIGNED` | YES | `NULL` | FK -> `users(id)` (`SET NULL`) | Internal | Administrative user who approved leave |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Record creation timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Record modification timestamp |

---

### 2.8 Table: `appointments`
- **Purpose:** Authoritative dental visit record holding patient, practitioner, duration/price snapshots, interval, and lifecycle status.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique appointment reference number |
| `patient_id` | `BIGINT UNSIGNED` | NO | None | FK -> `patients(id)` (`RESTRICT`), INDEX (`idx_appointments_patient_start`) | PII | Subject patient reference |
| `dentist_id` | `BIGINT UNSIGNED` | NO | None | FK -> `dentists(id)` (`RESTRICT`), INDEX (`idx_appointments_dentist_start`) | Internal | Attending practitioner reference |
| `service_id` | `BIGINT UNSIGNED` | NO | None | FK -> `services(id)` (`RESTRICT`) | Public | Booked dental procedure |
| `start_at` | `DATETIME` | NO | None | CHECK (`start_at < end_at`), INDEX (`idx_appointments_overlap`) | Internal | Procedure start time in `Asia/Manila` |
| `end_at` | `DATETIME` | NO | None | INDEX (`idx_appointments_overlap`) | Internal | Procedure end time (`start_at + duration`) |
| `duration_snapshot` | `INT UNSIGNED` | NO | None | None | Internal | Immutable duration snapshot in minutes |
| `price_snapshot` | `DECIMAL(10,2)` | NO | None | CHECK (`price_snapshot >= 0.00`) | Internal | Immutable fee snapshot in PHP at booking time |
| `status` | `ENUM('PENDING','CONFIRMED','REJECTED','CANCELLED','COMPLETED')` | NO | `'PENDING'` | INDEX (`idx_appointments_status_start`, `idx_appointments_overlap`) | Internal | Authoritative appointment state |
| `chief_complaint` | `TEXT` | YES | `NULL` | None | PII | Patient-described symptoms or notes |
| `operatory_chair` | `VARCHAR(50)` | NO | `'Chair 1'` | None | Internal | Assigned operatory chair suite |
| `rescheduled_from_id` | `BIGINT UNSIGNED` | YES | `NULL` | FK -> `appointments(id)` (`SET NULL`), INDEX (`idx_appointments_rescheduled_from`) | Internal | Self-referencing FK linking to cancelled original booking |
| `cancellation_reason` | `VARCHAR(255)` | YES | `NULL` | None | Internal | Mandatory cancellation reason code or note |
| `cancelled_by_user_id`| `BIGINT UNSIGNED` | YES | `NULL` | FK -> `users(id)` (`SET NULL`) | Internal | User who initiated cancellation |
| `cancelled_at` | `DATETIME` | YES | `NULL` | None | Internal | Cancellation timestamp |
| `reviewed_by_user_id` | `BIGINT UNSIGNED` | YES | `NULL` | FK -> `users(id)` (`SET NULL`) | Internal | Receptionist/Admin who approved or rejected |
| `reviewed_at` | `DATETIME` | YES | `NULL` | None | Internal | Approval/rejection timestamp |
| `completed_at` | `DATETIME` | YES | `NULL` | None | Internal | Visit completion timestamp |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Booking submission timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Last update timestamp |

---

### 2.9 Table: `appointment_status_history`
- **Purpose:** Immutable audit event ledger recording every status change, actor, and reason.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique history entry ID |
| `appointment_id` | `BIGINT UNSIGNED` | NO | None | FK -> `appointments(id)` (`RESTRICT`), INDEX (`idx_status_history_appointment`) | Internal | Referenced appointment |
| `old_status` | `ENUM(...)` | YES | `NULL` | None | Internal | Prior status (`NULL` on initial creation) |
| `new_status` | `ENUM(...)` | NO | None | None | Internal | Target status transitioned into |
| `actor_user_id` | `BIGINT UNSIGNED` | YES | `NULL` | FK -> `users(id)` (`SET NULL`) | Internal | User actor who executed state change |
| `reason` | `VARCHAR(255)` | YES | `NULL` | None | Internal | Text reason for change |
| `metadata` | `JSON` | YES | `NULL` | None | Internal | Contextual payload (channel, IP, admin notes) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | INDEX (`idx_status_history_created_at`) | Internal | State transition timestamp |

---

### 2.10 Table: `treatment_records`
- **Purpose:** Permanent clinical visit documentation authored exclusively by assigned practitioner.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique clinical treatment record ID |
| `appointment_id` | `BIGINT UNSIGNED` | NO | None | UNIQUE, FK -> `appointments(id)` (`RESTRICT`) | Internal | 1:1 linked completed visit reference |
| `dentist_id` | `BIGINT UNSIGNED` | NO | None | FK -> `dentists(id)` (`RESTRICT`), INDEX (`idx_treatment_records_dentist`) | Internal | Authoring practitioner reference |
| `patient_id` | `BIGINT UNSIGNED` | NO | None | FK -> `patients(id)` (`RESTRICT`), INDEX (`idx_treatment_records_patient`) | PII | Subject patient reference |
| `teeth_treated` | `JSON` | YES | `NULL` | None | Sensitive | Array of FDI two-digit tooth notations (e.g. `[14, 45]`) |
| `diagnosis` | `TEXT` | NO | None | None | Sensitive | Clinical examination diagnosis and findings |
| `procedure_notes`| `TEXT` | NO | None | None | Sensitive | Detailed treatment procedure and materials used |
| `prescription_notes`| `TEXT` | YES | `NULL` | None | Sensitive | Medications prescribed and dosages |
| `home_care_advice`| `TEXT` | YES | `NULL` | None | Sensitive | Post-treatment recovery and hygiene advice |
| `locked_at` | `DATETIME` | YES | `NULL` | None | Internal | Permanently locked against edits 24h post-completion |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Authoring timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Last amendment timestamp (audited) |

---

### 2.11 Table: `notifications`
- **Purpose:** Persistent in-app user notifications and read receipts.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique notification ID |
| `user_id` | `BIGINT UNSIGNED` | NO | None | FK -> `users(id)` (`CASCADE`), INDEX (`idx_notifications_user_read`) | Internal | Recipient user reference |
| `role` | `ENUM(...)` | NO | None | None | Internal | Intended role context |
| `type` | `VARCHAR(100)` | NO | None | None | Internal | Event type identifier |
| `title` | `VARCHAR(255)` | NO | None | None | Internal | Short title summary |
| `message` | `TEXT` | NO | None | None | Internal | Notification content (zero sensitive clinical PHI) |
| `reference_type` | `VARCHAR(50)` | YES | `'appointments'` | None | Internal | Target entity table |
| `reference_id` | `BIGINT UNSIGNED` | YES | `NULL` | None | Internal | Target entity ID for deep-linking |
| `read_at` | `DATETIME` | YES | `NULL` | INDEX (`idx_notifications_user_read`) | Internal | Timestamp when marked read (`NULL=Unread`) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | INDEX (`idx_notifications_created_at`) | Internal | Notification creation timestamp |

---

### 2.12 Table: `email_outbox`
- **Purpose:** Asynchronous, persistent email queue ensuring transactional decoupling from SMTP server availability.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique outbox job ID |
| `user_id` | `BIGINT UNSIGNED` | YES | `NULL` | FK -> `users(id)` (`SET NULL`) | Internal | Optional recipient user account reference |
| `recipient_email`| `VARCHAR(255)`| NO | None | None | PII | Delivery email address |
| `recipient_name` | `VARCHAR(150)`| NO | None | None | PII | Recipient display name |
| `subject` | `VARCHAR(255)` | NO | None | None | Internal | Email subject line |
| `body_html` | `MEDIUMTEXT` | NO | None | None | Internal | HTML email body (contains zero clinical notes) |
| `body_text` | `TEXT` | NO | None | None | Internal | Plain-text fallback email body |
| `status` | `ENUM('PENDING','PROCESSING','SENT','FAILED_RETRYABLE','FAILED_PERMANENT')` | NO | `'PENDING'` | INDEX (`idx_email_outbox_queue`) | Internal | Delivery lifecycle state |
| `attempts` | `TINYINT UNSIGNED` | NO | `0` | INDEX (`idx_email_outbox_queue`) | Internal | Number of delivery attempts made |
| `max_attempts` | `TINYINT UNSIGNED` | NO | `5` | None | Internal | Maximum allowed retries before permanent failure |
| `last_error` | `TEXT` | YES | `NULL` | None | Internal | Error message from failed SMTP attempt |
| `next_attempt_at`| `DATETIME` | NO | `CURRENT_TIMESTAMP` | INDEX (`idx_email_outbox_queue`) | Internal | Exponential backoff scheduling timestamp |
| `sent_at` | `DATETIME` | YES | `NULL` | None | Internal | Successful SMTP transmission timestamp |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | INDEX (`idx_email_outbox_created_at`) | Internal | Outbox job queueing timestamp |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | None | Internal | Last job update timestamp |

---

### 2.13 Table: `auth_tokens`
- **Purpose:** Single-use, expiring, cryptographically hashed tokens for password resets and email verification.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique token record ID |
| `user_id` | `BIGINT UNSIGNED` | NO | None | FK -> `users(id)` (`CASCADE`) | Internal | Target user reference |
| `token_hash` | `VARCHAR(255)` | NO | None | UNIQUE, INDEX (`idx_auth_tokens_lookup`) | Restricted | SHA-256 hash of high-entropy token (never plaintext) |
| `token_type` | `ENUM('EMAIL_VERIFY','PASSWORD_RESET')` | NO | None | INDEX (`idx_auth_tokens_lookup`) | Internal | Purpose restriction |
| `expires_at` | `DATETIME` | NO | None | INDEX (`idx_auth_tokens_lookup`) | Internal | Token expiration timestamp |
| `used_at` | `DATETIME` | YES | `NULL` | INDEX (`idx_auth_tokens_lookup`) | Internal | Consumption timestamp (`NULL=Unused`) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | None | Internal | Issuance timestamp |

---

### 2.14 Table: `audit_logs`
- **Purpose:** Permanent administrative action, security event, and treatment record amendment audit trail.
- **Storage Engine:** InnoDB | **Collation:** `utf8mb4_unicode_ci`

| Column Name | Data Type | Nullable | Default | Constraints & Keys | Sensitivity | Description |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | PK | Internal | Unique audit record ID |
| `actor_user_id` | `BIGINT UNSIGNED` | YES | `NULL` | FK -> `users(id)` (`SET NULL`) | Internal | Acting user ID (`NULL` for system / unauthenticated) |
| `action` | `VARCHAR(100)` | NO | None | INDEX (`idx_audit_logs_action`) | Internal | Action code (e.g. `AUTH_LOGIN`, `APPOINTMENT_CONFIRMED`) |
| `target_type` | `VARCHAR(50)` | NO | None | INDEX (`idx_audit_logs_target`) | Internal | Target resource entity (e.g. `appointments`, `users`) |
| `target_id` | `BIGINT UNSIGNED` | YES | `NULL` | INDEX (`idx_audit_logs_target`) | Internal | Target resource primary key |
| `ip_address` | `VARCHAR(45)` | YES | `NULL` | None | PII | Client IPv4 or IPv6 address |
| `user_agent` | `VARCHAR(255)` | YES | `NULL` | None | Internal | Client browser / device user agent |
| `sanitized_payload`| `JSON` | YES | `NULL` | None | Internal | Structured metadata (passwords and tokens stripped) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | INDEX (`idx_audit_logs_action`, `idx_audit_logs_created_at`) | Internal | Audit timestamp |
