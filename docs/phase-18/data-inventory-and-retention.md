# Data Inventory and Proposed Retention Framework

> **Governance Note:** Retention windows below are **proposed technical baselines** only. Final retention and disposal periods must be approved by the clinic's Data Protection Officer (DPO) and legal/clinical governance before enabling automated purging.

| Table / Store | Sensitivity | Contains PII / Health Data? | Current Deletion Behavior | Proposed Retention Policy (Pending DPO Approval) |
|---|---|---|---|---|
| `users` | High | Yes (email, credentials hash) | Soft deactivation (`is_active = 0`) | Retain while active; archive/anonymize per approved account-closure policy |
| `patients` | Critical (SPI) | Yes (demographics, emergency contact, medical alerts) | Preserved (no auto-delete) | Retain per clinic & Philippine dental recordkeeping policy |
| `appointments` & `appointment_status_history` | High | Yes (patient-dentist visit linkage) | Preserved (status transitions only) | Retain alongside clinical records per approved policy |
| `treatment_records` | Critical (SPI) | Yes (diagnosis, notes, FDI tooth chart) | Versioned/amended, never hard-deleted | Retain per statutory/clinical dental record retention schedule |
| `notifications` | Medium | Limited (appointment status alerts) | Marked read; preserved | Proposed: purge read notifications older than 90–180 days (once approved) |
| `email_outbox` | High | Yes (recipient email, encrypted payload) | Processed by worker | Proposed: retain metadata 90 days; purge payloads after delivery window |
| `realtime_tickets` & `realtime_outbox` | Medium | Session/user linkage | Short TTL (tickets expire in seconds) | Safe to prune expired/published records after 7–30 days |
| `audit_logs` | High | Actor ID, IP, User-Agent, action metadata | Append-only | Proposed: retain minimum 1–3 years per institutional security policy |
| Application Logs (`backend/storage/logs/`) | Medium | Redacted operational diagnostics | File-based | Rotate daily; retain 30–90 days; never store unredacted SPI or secrets |
| Encrypted DB Backups (`backups/`) | Critical (SPI) | Full database snapshot (AES-256-GCM) | Managed by `DatabaseBackupService` | Follow approved 3-2-1 backup retention (e.g., 14–30 daily, 12 monthly) |
