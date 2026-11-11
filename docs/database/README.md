# ToothCare Hub — Complete Database Documentation

Welcome to the definitive database documentation for ToothCare Hub.

## Document Directory
- [Database Architecture](architecture.md) — Topology, MySQL 8.0 configuration, InnoDB engine, Asia/Manila timezone, and connection credentials.
- [Entity-Relationship Diagram (ERD)](erd.mmd) — Mermaid relational diagram covering all 30 entities and relationships.
- [Data Dictionary](data-dictionary.md) — Comprehensive schema definitions, column data types, constraints, and descriptions across all 30 tables.
- [Docker Database Setup](docker-database-setup.md) — Running MySQL 8.0, health checks, environment variables, and migration instructions.
- [Demo Accounts & Authentication](demo-accounts.md) — Active database user credentials, role mapping, and removal of client-side shortcuts.
- [Backup and Disaster Recovery](backup-and-restore.md) — Automated daemons, manual CLI backups, and step-by-step restoration procedures.

---

## Quick Reference: 30 Database Tables

| Module | Tables |
|---|---|
| **Authentication & RBAC** | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `email_verification_tokens`, `password_reset_tokens`, `auth_tokens` |
| **Clinic Management** | `patients`, `dentists`, `services`, `dentist_services` |
| **Scheduling** | `dentist_schedules`, `dentist_schedule_exceptions`, `dentist_time_off`, `clinic_operating_hours`, `clinic_closures` |
| **Appointments** | `appointments`, `appointment_statuses`, `appointment_status_history` |
| **Clinical Records** | `treatment_records`, `treatment_record_versions` |
| **Notifications & Outbox** | `notifications`, `email_outbox`, `outbox` |
| **Security & Auditing** | `audit_logs`, `security_events`, `rate_limits` |
| **Configuration & Ledger** | `clinic_settings`, `schema_migrations` |
