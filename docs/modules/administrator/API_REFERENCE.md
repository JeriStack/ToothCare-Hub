# Administrator Control Center API Reference

All endpoints require an authenticated session (`HttpOnly` cookie) and enforce Dynamic Role-Based Access Control (DRBAC) permissions (`401 Unauthorized` / `403 FORBIDDEN`). `POST /api/v1/auth/login` and `GET /api/v1/auth/me` return the user's effective `permissions` array. Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) additionally enforce CSRF token validation via `X-CSRF-Token`.

---

## 1. Executive Dashboard
* **`GET /api/v1/admin/dashboard`** (`dashboard.view`)
  * Returns aggregate patient/dentist/service/appointment metrics (11 core KPIs), today's clinical schedule, pending review queue peek, recent audit activity, and system security alerts.

---

## 2. User & Staff Account Management
* **`GET /api/v1/admin/users`** (`users.view`)
  * Query Params: `search`, `role` (`ADMIN`|`DENTIST`|`RECEPTIONIST`|`PATIENT`), `is_active` (`1`|`0`), `email_verified`, `page`, `per_page`, `sort_by`, `sort_dir`.
  * Returns paginated directory with linked dentist/patient metadata.
* **`GET /api/v1/admin/users/{id}`** (`users.view`)
  * Returns full account details and associated practitioner or patient record.
* **`POST /api/v1/admin/users`** (`users.manage`)
  * Body: `{ email, password, role, first_name, last_name, phone?, specialization?, license_number? }`
  * Provisions staff account and creates linked dentist profile when `role === 'DENTIST'`.
  * Returns `201 Created` or `409 Conflict` if email already registered.
* **`PATCH /api/v1/admin/users/{id}/status`** (`users.manage`)
  * Body: `{ is_active: boolean | 0 | 1 }`
  * Toggles account access while guarding against deactivating the last active Administrator (`403 ADMIN_LOCKOUT_PREVENTED`) and records `before`/`after` status diffs.
* **`PATCH /api/v1/admin/users/{id}/role`** (`users.manage`)
  * Body: `{ role: 'ADMIN' | 'DENTIST' | 'RECEPTIONIST' | 'PATIENT' }`
  * Reassigns user role and syncs `user_roles`, guarding against demoting the last active Administrator (`403 ADMIN_LOCKOUT_PREVENTED`) and records `before`/`after` role diffs.

---

## 3. Dynamic Role-Based Access Control (DRBAC)
* **`GET /api/v1/admin/roles`** (`roles.manage`)
  * Lists all system roles with active user counts and currently assigned permission slugs.
* **`GET /api/v1/admin/permissions`** (`roles.manage`)
  * Lists all 22 system permission capabilities grouped across 11 modules (`users`, `patients`, `dentists`, `services`, `appointments`, `clinical`, `security`, `settings`, `dashboard`, `reports`, `system`).
* **`PUT /api/v1/admin/roles/{id}/permissions`** (`roles.manage`)
  * Body: `{ permissions: string[] }`
  * Atomically updates `role_permissions` and records `before`/`after` permission diffs. Protected permissions on `admin` (`users.view`, `users.manage`, `roles.manage`, `audit_logs.view`, `settings.manage`) are automatically preserved.

---

## 4. Audit Trail & Security Events
* **`GET /api/v1/admin/audit-logs`** (`audit_logs.view`)
  * Query Params: `search`, `action`, `target_type`, `actor_user_id`, `date_from`, `date_to`, `page`, `per_page`.
  * Returns immutable forensic audit logs with decoded JSON payloads (including `before`/`after` change diffs) and actor context.
* **`GET /api/v1/admin/audit-logs/export`** (`audit_logs.export`)
  * Streams filtered audit history as downloadable CSV (`text/csv`) and records `AUDIT_LOG_EXPORTED`.
* **`GET /api/v1/admin/security/events`** (`audit_logs.view`)
  * Returns security-focused failed logins, rate-limit triggers, blocked logins, password resets, account activations/deactivations, role updates, DRBAC changes, and lockout events.

---

## 5. Clinic Settings Configuration
* **`GET /api/v1/admin/clinic/settings`** (`settings.manage`)
  * Retrieves typed configuration key-value settings.
* **`PUT /api/v1/admin/clinic/settings`** (`settings.manage`)
  * Updates clinic metadata (`clinic_name`, `clinic_phone`, `clinic_email`, `clinic_address`, `booking_advance_days_max`, `cancellation_cutoff_hours`, `slot_duration_default_minutes`, etc.) and writes an audit record with `before`/`after` diffs.

---

## 6. Reports & System Health
* **`GET /api/v1/admin/reports/appointments`** (`reports.view`, params: `start_date`, `end_date`)
* **`GET /api/v1/admin/reports/revenue`** (`reports.view`, params: `start_date`, `end_date`)
* **`GET /api/v1/admin/reports/dentists`** (`reports.view`, params: `start_date`, `end_date`)
* **`GET /api/v1/admin/system/health`** (`system.health`)
  * Reports MySQL ping latency, active connection threads, database storage size, PHP-FPM memory telemetry, realtime service TCP reachability, active rate-limit locks, and backup volume/snapshot telemetry.
