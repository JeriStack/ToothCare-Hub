# ToothCare Hub — Database Architecture Specification

## 1. Executive Summary

ToothCare Hub utilizes a single-clinic, enterprise-grade relational database running on **MySQL 8.0 (InnoDB engine)** configured with standard timezone `Asia/Manila` and strict referential integrity (`utf8mb4_unicode_ci`).

The database is organized into **6 core functional modules** encompassing **30 tables**:

1. **Authentication & RBAC**: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `email_verification_tokens`, `password_reset_tokens`, `auth_tokens`.
2. **Clinic Management**: `patients`, `dentists`, `services`, `dentist_services`.
3. **Scheduling & Availability**: `dentist_schedules`, `dentist_schedule_exceptions`, `dentist_time_off`, `clinic_operating_hours`, `clinic_closures`.
4. **Appointments Lifecycle**: `appointments`, `appointment_statuses`, `appointment_status_history`.
5. **Clinical Documentation**: `treatment_records`, `treatment_record_versions`.
6. **Notifications & Transactional Outbox**: `notifications`, `email_outbox`, `outbox`.
7. **Security, Auditing & Configuration**: `audit_logs`, `security_events`, `rate_limits`, `clinic_settings`, `schema_migrations`.

---

## 2. Server Configuration & Charset
- **Engine**: MySQL 8.0 Community Server (Dockerized via `toothcare-mysql`).
- **Default Storage Engine**: `InnoDB` (ACID compliant with row-level locking).
- **Default Character Set**: `utf8mb4`
- **Default Collation**: `utf8mb4_unicode_ci` (multilingual support, emoji compatibility, case-insensitive index lookups).
- **Timezone**: `Asia/Manila` (UTC+8) throughout all timestamp columns.
- **Foreign Keys**: Enabled (`SET FOREIGN_KEY_CHECKS = 1`), enforcing cascading updates, restricted deletes, and orphaned record prevention.

---

## 3. Connection Topology
- **Docker Network**: `toothcare-network` (app bridge network).
- **Service Name**: `mysql` (accessible by `toothcare-php-fpm`, `toothcare-email-worker`, and `toothcare-db-backup`).
- **Internal Port**: `3306`
- **Application User**: `toothcare_user` (and alias `toothcare_app`) authenticated via native MySQL caching_sha2_password / mysql_native_password.
- **Root Superuser**: `root` with restricted container loopback access.
