# Administrator Control Center, DRBAC & Audit Trail

## Overview

The ToothCare Hub Administrator Control Center empowers clinic administrators with real-time operational oversight, dynamic permission governance, forensic auditability, analytics reporting, and infrastructure health diagnostics.

---

## Core Modules

### 1. Executive Dashboard (`AdminDashboard.jsx`)
- **11 Real-Time Clinical & Practice KPIs:**
  - Total Patients & Active Patients
  - Total Dentists & Active Dentists
  - Active Dental Services
  - Total Appointments, Today's Appointments, Pending Requests, Confirmed Appointments, Completed Visits, Cancelled Appointments
- **Live Telemetry:** Real-time `Asia/Manila (UTC+8)` system clock, operational & security alerts banner, today's clinical schedule, pending review queue peek, recently registered patients, service catalog overview, and live audit feed.

### 2. User & Staff Account Management (`UserManagementPage.jsx`, `UserController.php`)
- Search and filter accounts by identity, role (`ADMIN`, `DENTIST`, `RECEPTIONIST`, `PATIENT`), and activation status.
- Provision clinic staff accounts (`ADMIN`, `DENTIST`, `RECEPTIONIST`) with server-side validation and automatic linked practitioner profile creation.
- Activate/deactivate accounts while preserving historical clinical relationships.
- Role reassignment with **super-admin lockout prevention** (system forbids deactivating or demoting the last active `ADMIN` account).

### 3. Dynamic Role-Based Access Control — DRBAC (`RolePermissionMatrixPage.jsx`, `RolePermissionController.php`)
- Database-driven capability permission model built on `roles`, `permissions`, `role_permissions`, and `user_roles`, enforced across route middleware (`AuthorizationMiddleware::hasPermission()`) and controllers (`AuthorizationMiddleware::requireUserPermission()`).
- Authenticated sessions (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`) hydrate the user's effective `permissions` array for frontend gating (`AuthContext::hasPermission()`).
- Interactive permissions matrix grouped across 11 modules (`users`, `patients`, `dentists`, `services`, `appointments`, `clinical`, `security`, `settings`, `dashboard`, `reports`, `system`).
- Real-time role permission toggling with transactionally atomic saves and core admin lockout safeguards (`users.view`, `users.manage`, `roles.manage`, `audit_logs.view`, `settings.manage` cannot be removed from Administrator).

### 4. Forensic Audit Trail & Security Events (`AuditTrailPage.jsx`, `AuditLogController.php`)
- Append-only audit trail recording clinical, administrative, authentication, and authorization events with sanitized payloads and structured `before`/`after` comparison snapshots on status, role, DRBAC matrix, and clinic setting mutations.
- Multi-dimensional filtering by search term, action(s), target entity/module, and date range, plus a side-by-side Before/After Change Comparison inspector in the UI.
- **Security Events View:** Streams failed logins, rate-limit events, blocked logins, password resets, user activations/deactivations/role changes, DRBAC permission updates, and lockout events.
- **CSV Export:** Generates RFC 4180 CSV dumps for compliance review (gated by `audit_logs.export`) and records an `AUDIT_LOG_EXPORTED` entry.

### 5. Reports & Analytics (`ReportsPage.jsx`, `ReportController.php`)
- Date-ranged clinical analytics computing completion rates, cancellation rates, procedure revenue realization (Completed vs. Potential), and individual dentist caseloads.

### 6. System Health & Clinic Settings (`SystemHealthPage.jsx`, `HealthController.php`, `ClinicSettingsController.php`)
- Live diagnostics covering MySQL latency, connection thread counts, database storage footprint, PHP-FPM memory consumption, realtime service TCP reachability, active rate-limit locks, and persistent volume/backup directory status.
- Synchronized global operating settings (`clinic_name`, `clinic_phone`, `clinic_email`, `clinic_address`, `booking_advance_days_max`, `cancellation_cutoff_hours`, `slot_duration_default_minutes`) with Before/After audit logging.
