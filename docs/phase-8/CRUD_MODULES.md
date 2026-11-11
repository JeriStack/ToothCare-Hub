# Phase 8 — Administrative CRUD Modules Specification

---

## 1. Dental Service Management Module

### Domain Rules & Database Constraints
- **Table**: `services` (InnoDB)
- **Check Constraints**:
  - `chk_services_price`: Fee must be non-negative (`price >= 0.00`).
  - `chk_services_duration`: Standard scheduling intervals must be in `(15, 30, 45, 60, 90, 120)` minutes.
- **Unique Constraint**: `uq_services_name` enforces unique procedure naming.
- **Foreign Key Safety**: Appointments reference `service_id` with `ON DELETE RESTRICT`. Physical row deletion is forbidden; administrative deactivation (`is_active = 0`) must be used.

### Validator Specification (`ServiceValidator`)
- `name`: 2–150 characters, trimmed.
- `price`: Valid numeric, `>= 0.00`, stored and rendered with 2 decimal precision.
- `duration_minutes`: Integer member of allowed duration set.
- `category`: String up to 100 characters; defaults to `'General'`.
- `description`: Optional text.
- `is_active`: 0 or 1.

---

## 2. Dentist Profile Management Module

### Domain Rules & Database Constraints
- **Tables**: `dentists` and `users` (InnoDB)
- **Atomic Creation**:
  Creating a dentist executes within a database transaction:
  1. Inserts into `users` table with role `DENTIST` and hashed password (`PASSWORD_BCRYPT`).
  2. Inserts into `dentists` table with `user_id`, PRC license number, chair, and specialization.
  3. Records audit log `DENTIST_PROFILE_CREATED`.
- **Status Synchronization**:
  When a dentist is marked inactive (`dentists.is_active = 0`), the corresponding user account (`users.is_active = 0`) is updated in tandem. This ensures that a retired or on-leave practitioner cannot log in to the clinical portal while their existing consultation history is fully preserved.

### Validator Specification (`DentistValidator`)
- `first_name` & `last_name`: 2–100 characters.
- `email`: Valid RFC email format, unique across users.
- `password`: Minimum 8 characters, required on creation.
- `license_number`: PRC format, unique across dentists.
- `specialization`: e.g. General Dentistry, Orthodontics, Endodontics, Periodontics, Pediatric Dentistry, Oral Surgery.
- `phone`: 7–30 characters.
- `default_operatory_chair`: Default operatory assignment (e.g. Chair 1, Chair 2).

---

## 3. Patient Records Management Module

### Domain Rules & Database Constraints
- **Tables**: `patients` and `users`
- **Resource Ownership**:
  Non-admin patients can only view and update their own profile (`user_id = auth.user_id`). Administrators have global access to all records.
- **Account Control**:
  Admins can toggle patient account login status (`users.is_active = 0`). Disabling an account immediately prevents login and new appointments while strictly retaining:
  - All past appointment records (`appointments`).
  - Historical clinical charts and treatment notes (`treatment_records`).
  - Prescriptions and allergy alerts.

### Validator Specification (`PatientValidator`)
- `first_name` & `last_name`: 2–100 characters.
- `date_of_birth`: Valid date format `YYYY-MM-DD`, cannot be in the future.
- `phone`: 7–30 characters.
- `gender`: Member of `['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']`.
- `emergency_contact_name` & `emergency_contact_phone`: Optional contact records for clinical emergencies.
- `medical_alerts`: High-visibility clinical warning text (e.g. penicillin allergies, hypertension).

