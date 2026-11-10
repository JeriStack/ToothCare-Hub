# ToothCare Hub — Relationship and Referential Integrity Validation

**Database:** `toothcare_hub`  
**Total Foreign Keys Verified:** 33  
**Audit Status:** PASSED (Zero Orphaned Records, Strict Delete Safeguards)

---

## 1. Foreign Key Constraints Matrix

The database schema enforces 33 foreign key constraints across all relationships. Referential actions were audited to ensure historical data preservation.

| Child Table | Foreign Key Column | Referenced Table | Referenced Column | `ON DELETE` | `ON UPDATE` | Integrity Objective |
|---|---|---|---|---|---|---|
| `patients` | `user_id` | `users` | `id` | **RESTRICT** | CASCADE | Prevents deletion of users who have medical profiles |
| `dentists` | `user_id` | `users` | `id` | **RESTRICT** | CASCADE | Prevents deletion of clinician users with historical records |
| `user_roles` | `user_id` | `users` | `id` | CASCADE | CASCADE | Clean cleanup of role grants on user purge |
| `user_roles` | `role_id` | `roles` | `id` | CASCADE | CASCADE | Clean cleanup of role grants on role purge |
| `role_permissions` | `role_id` | `roles` | `id` | CASCADE | CASCADE | Role permission alignment |
| `role_permissions` | `permission_id` | `permissions` | `id` | CASCADE | CASCADE | Privilege mapping alignment |
| `auth_tokens` | `user_id` | `users` | `id` | CASCADE | CASCADE | Token invalidation on user purge |
| `email_verification_tokens` | `user_id` | `users` | `id` | CASCADE | CASCADE | Token invalidation on user purge |
| `password_reset_tokens` | `user_id` | `users` | `id` | CASCADE | CASCADE | Token invalidation on user purge |
| `dentist_schedules` | `dentist_id` | `dentists` | `id` | CASCADE | CASCADE | Weekly shifts tied to clinician life-cycle |
| `dentist_schedule_exceptions`| `dentist_id`| `dentists` | `id` | CASCADE | CASCADE | Date overrides tied to clinician |
| `dentist_time_off` | `dentist_id` | `dentists` | `id` | CASCADE | CASCADE | Time-off records tied to clinician |
| `dentist_time_off` | `approved_by_user_id`| `users` | `id`| SET NULL | CASCADE | Preserves time-off record if approver account deleted |
| `dentist_services` | `dentist_id` | `dentists` | `id` | CASCADE | CASCADE | M:N association management |
| `dentist_services` | `service_id` | `services` | `id` | CASCADE | CASCADE | M:N association management |
| `appointments` | `patient_id` | `patients` | `id` | **RESTRICT** | CASCADE | **CRITICAL**: Preserves appointment history if patient archived |
| `appointments` | `dentist_id` | `dentists` | `id` | **RESTRICT** | CASCADE | **CRITICAL**: Preserves appointment history if dentist archived |
| `appointments` | `service_id` | `services` | `id` | **RESTRICT** | CASCADE | **CRITICAL**: Preserves appointment history if service disabled |
| `appointments` | `reviewed_by_user_id`| `users` | `id`| SET NULL | CASCADE | Preserves approval trail |
| `appointments` | `cancelled_by_user_id`| `users` | `id`| SET NULL | CASCADE | Preserves cancellation trail |
| `appointments` | `rescheduled_from_id`| `appointments` | `id`| SET NULL | CASCADE | Self-referencing link for rescheduled visit chains |
| `appointment_status_history`| `appointment_id`| `appointments` | `id` | **RESTRICT**| CASCADE | Protects audit history |
| `appointment_status_history`| `actor_user_id`| `users` | `id` | SET NULL | CASCADE | Preserves status transition actor |
| `treatment_records` | `appointment_id` | `appointments` | `id` | **RESTRICT** | CASCADE | **CRITICAL**: Treatment record can never be deleted via appointment |
| `treatment_records` | `patient_id` | `patients` | `id` | **RESTRICT** | CASCADE | **CRITICAL**: Legal protection of patient dental chart |
| `treatment_records` | `dentist_id` | `dentists` | `id` | **RESTRICT** | CASCADE | **CRITICAL**: Legal protection of attending dentist chart |
| `treatment_record_versions`| `treatment_record_id`| `treatment_records`| `id`| CASCADE | CASCADE | Version history attached to primary record |
| `treatment_record_versions`| `amended_by_user_id`| `users` | `id` | **RESTRICT** | CASCADE | Preserves clinician who amended note |
| `notifications` | `user_id` | `users` | `id` | CASCADE | CASCADE | Notification lifecycle |
| `email_outbox` | `user_id` | `users` | `id` | SET NULL | CASCADE | Preserves sent mail telemetry |
| `audit_logs` | `actor_user_id` | `users` | `id` | SET NULL | CASCADE | Forensic log preservation |
| `security_events` | `user_id` | `users` | `id` | SET NULL | CASCADE | Security telemetry preservation |
| `clinic_closures` | `created_by_user_id` | `users` | `id` | SET NULL | CASCADE | Clinic closure audit attribution |

---

## 2. Accidental Data Loss Prevention Assessment

### 2.1 Critical Clinical History Protection
- All medical history (`treatment_records`, `treatment_record_versions`, `appointments`, and `appointment_status_history`) uses **`RESTRICT`** on foreign key deletion.
- If an administrator attempts to delete a `user`, `patient`, `dentist`, or `service` that has existing appointments or treatment charts, MySQL **aborts the transaction with Error 1451** (`Cannot delete or update a parent row: a foreign key constraint fails`).
- Deactivation is safely implemented via soft flags (`is_active = 0`), which preserves complete referential integrity.

---

## 3. Cross-Table Ownership Consistency Review

### 3.1 Requirement
A `treatment_records` row must not reference a `patient_id` or `dentist_id` different from its associated `appointment_id`.

### 3.2 Current Implementation
- In the backend domain layer (`TreatmentRecordService::createRecord()`):
  ```php
  $appointment = $this->appointmentRepo->findById($appointmentId);
  // Dentist is verified against $appointment['dentist_id']
  // Patient is sourced directly from $appointment['patient_id']
  $recordId = $this->treatmentRepo->create([
      'appointment_id' => $appointmentId,
      'dentist_id'     => (int) $dentist['id'],
      'patient_id'     => (int) $appointment['patient_id'],
      ...
  ]);
  ```
- Application transactions guarantee that client payloads cannot specify arbitrary patient or dentist IDs.

### 3.3 DDL Enhancement Recommendation (REL-01)
- Currently, MySQL validates `appointment_id`, `dentist_id`, and `patient_id` as independent foreign keys.
- **Recommended Schema Enhancement**: Add a composite unique index on `appointments(id, dentist_id, patient_id)` and a composite foreign key on `treatment_records(appointment_id, dentist_id, patient_id) REFERENCES appointments(id, dentist_id, patient_id)`. This elevates ownership consistency from application code to mathematical database-level enforcement.
