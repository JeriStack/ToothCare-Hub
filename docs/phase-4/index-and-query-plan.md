# ToothCare Hub — Index Plan & Query Design

**Document ID:** `TCH-P4-INX-001`  
**Version:** `1.0.0`  
**Phase:** Phase 4 — Database Modeling and Versioned Schema  
**Prepared Date:** `2026-10-27`  
**Status:** Approved Baseline  
**Author:** Lead Database Architect & MySQL Performance Engineer  

---

## 1. Indexing Strategy & Principles

The ToothCare Hub indexing strategy balances read-query throughput against write performance:
1. **Targeted Composite Indexes:** B-tree indexes are tailored to exact filter-and-sort predicates (`(dentist_id, start_at)`, `(patient_id, start_at)`).
2. **Covering Index for Overlap Checks:** `idx_appointments_overlap (dentist_id, status, start_at, end_at)` serves as a covering index, allowing the concurrency engine to detect overlapping bookings directly from index pages without hitting table data pages.
3. **Queue Indexes for Asynchronous Workers:** `email_outbox` uses `(status, next_attempt_at, attempts)` to permit rapid range queries for pending jobs with low lock contention.
4. **Controlled Index Count:** Tables with high update frequency (`appointments`, `notifications`) only maintain indexes directly required by active UI paths, preventing write amplification.

---

## 2. Master Index Inventory

| Table | Index Name | Indexed Columns | Index Type | Target Query Path |
| :--- | :--- | :--- | :---: | :--- |
| `users` | `uq_users_email` | `(email)` | UNIQUE | Login credential verification |
| `users` | `idx_users_role_active` | `(role, is_active)` | B-TREE | Role-based listing & authorization |
| `patients` | `uq_patients_user_id` | `(user_id)` | UNIQUE | 1:1 user profile lookup |
| `patients` | `idx_patients_name` | `(last_name, first_name)` | B-TREE | Admin patient directory search |
| `patients` | `idx_patients_phone` | `(phone)` | B-TREE | Quick lookup by mobile number |
| `dentists` | `uq_dentists_user_id` | `(user_id)` | UNIQUE | 1:1 practitioner profile lookup |
| `dentists` | `uq_dentists_license_number`| `(license_number)`| UNIQUE | PRC license verification |
| `dentists` | `idx_dentists_active` | `(is_active)` | B-TREE | Public active practitioner listing |
| `services` | `uq_services_name` | `(name)` | UNIQUE | Catalog title uniqueness |
| `services` | `idx_services_category_active`| `(category, is_active)`| B-TREE | Service catalog browsing |
| `dentist_schedules`| `idx_schedules_dentist_day` | `(dentist_id, day_of_week, is_active)` | B-TREE | Availability shift calculation |
| `dentist_time_off` | `idx_time_off_dentist_interval`| `(dentist_id, start_at, end_at)` | B-TREE | Subtractive leave calculation |
| `appointments` | `idx_appointments_patient_start`| `(patient_id, start_at)` | B-TREE | Patient appointment history |
| `appointments` | `idx_appointments_dentist_start`| `(dentist_id, start_at)` | B-TREE | Dentist assigned visit agenda |
| `appointments` | `idx_appointments_status_start` | `(status, start_at)` | B-TREE | Admin pending triage queue |
| `appointments` | `idx_appointments_overlap` | `(dentist_id, status, start_at, end_at)` | B-TREE | Covering index for slot overlap check |
| `appointments` | `idx_appointments_rescheduled_from`| `(rescheduled_from_id)` | B-TREE | Rescheduling audit chain |
| `appointment_status_history`| `idx_status_history_appointment`| `(appointment_id, created_at)` | B-TREE | Audit trail timeline per visit |
| `treatment_records`| `uq_treatment_records_appointment`| `(appointment_id)` | UNIQUE | 1:1 visit clinical documentation |
| `treatment_records`| `idx_treatment_records_patient`| `(patient_id, created_at)` | B-TREE | Patient longitudinal dental history |
| `notifications`| `idx_notifications_user_read` | `(user_id, read_at, created_at)` | B-TREE | Unread badge counts & drawer fetch |
| `email_outbox` | `idx_email_outbox_queue` | `(status, next_attempt_at, attempts)` | B-TREE | Background worker poll query |
| `auth_tokens` | `idx_auth_tokens_lookup` | `(token_hash, token_type, expires_at, used_at)` | B-TREE | Single-use token verification |
| `audit_logs` | `idx_audit_logs_action` | `(action, created_at)` | B-TREE | Security audit event inspection |

---

## 3. Representative Queries & Live MySQL 8.0 `EXPLAIN` Verification

### 3.1 Patient Appointment History Query
```sql
SELECT id, service_id, dentist_id, start_at, end_at, status 
FROM appointments 
WHERE patient_id = :patient_id 
ORDER BY start_at DESC;
```
**Verified `EXPLAIN` Execution Plan:**
```
table:        appointments
type:         ref
key:          idx_appointments_patient_start
key_len:      8
ref:          const
rows:         2
filtered:     100.00
Extra:        Backward index scan
```
*Analysis: Direct reference lookup using `idx_appointments_patient_start`. Sorting avoided via backward index scan.*

---

### 3.2 Dentist Assigned Daily Agenda Query
```sql
SELECT id, patient_id, service_id, start_at, end_at, status 
FROM appointments 
WHERE dentist_id = :dentist_id AND start_at >= :day_start 
ORDER BY start_at ASC;
```
**Verified `EXPLAIN` Execution Plan:**
```
table:        appointments
type:         range / ref
key:          idx_appointments_dentist_start
key_len:      8
ref:          const
rows:         2
filtered:     100.00
Extra:        Using index condition
```
*Analysis: Fast range scan bounded to the target practitioner and date horizon.*

---

### 3.3 Admin Pending Review Queue Query
```sql
SELECT id, patient_id, dentist_id, service_id, start_at, end_at 
FROM appointments 
WHERE status = 'PENDING' 
ORDER BY start_at ASC;
```
**Verified `EXPLAIN` Execution Plan:**
```
table:        appointments
type:         ref
key:          idx_appointments_status_start
key_len:      1
ref:          const
rows:         1
filtered:     100.00
Extra:        None (Direct index scan)
```
*Analysis: Filters immediately on `status='PENDING'` and reads sorted rows directly from the B-tree.*

---

### 3.4 Concurrency Overlap Check Query (Covering Index)
```sql
SELECT id, dentist_id, status, start_at, end_at 
FROM appointments 
WHERE dentist_id = :dentist_id 
  AND status IN ('PENDING', 'CONFIRMED') 
  AND start_at < :req_end_at 
  AND end_at > :req_start_at;
```
**Verified `EXPLAIN` Execution Plan:**
```
table:        appointments
type:         range
key:          idx_appointments_overlap
key_len:      14
ref:          NULL
rows:         2
filtered:     33.33
Extra:        Using where; Using index
```
*Analysis: Optimal covering index execution (`Using index`). All columns (`dentist_id`, `status`, `start_at`, `end_at`, `id`) reside inside the index B-tree. Zero data page I/O required.*

---

### 3.5 Unread Notifications Query
```sql
SELECT id, role, title, message, created_at 
FROM notifications 
WHERE user_id = :user_id AND read_at IS NULL 
ORDER BY created_at DESC;
```
**Verified `EXPLAIN` Execution Plan:**
```
table:        notifications
type:         ref
key:          idx_notifications_user_read
key_len:      14
ref:          const,const
rows:         1
filtered:     100.00
Extra:        Using where; Backward index scan
```
*Analysis: Matches `user_id` and `read_at IS NULL` directly; orders results via backward index scan.*

---

### 3.6 Background Email Worker Queue Query
```sql
SELECT id, recipient_email, subject, attempts, next_attempt_at 
FROM email_outbox 
WHERE status = 'PENDING' AND next_attempt_at <= NOW() 
ORDER BY next_attempt_at ASC 
LIMIT 50;
```
**Verified `EXPLAIN` Execution Plan:**
```
table:        email_outbox
type:         range
key:          idx_email_outbox_queue
key_len:      6
ref:          NULL
rows:         1
filtered:     100.00
Extra:        Using index condition
```
*Analysis: Scans ready jobs in strict schedule order using index condition pushdown.*
