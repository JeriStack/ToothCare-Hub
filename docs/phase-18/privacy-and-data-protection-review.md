# Privacy and Data Protection Review

> **Important Notice:** This document is a **technical privacy engineering review**. It is **not** a legal opinion, legal compliance certification, or substitute for formal review by the clinic's Data Protection Officer (DPO) or qualified legal counsel. **Real patient data must not be processed until the responsible institution completes formal privacy governance and legal review.**

---

## 1. Data Minimization & Purpose Limitation

| Data Category | Fields Collected | Operational Purpose | Required / Optional | Roles with Access |
|---|---|---|---|---|
| Account Identity | `email`, `password_hash`, `role`, `is_active`, `email_verified` | Authentication, account security, RBAC | Required | Owner (excluding hash), `ADMIN` |
| Patient Profile | `first_name`, `last_name`, `phone`, `date_of_birth`, `gender`, `address`, `emergency_contact_name`, `emergency_contact_phone`, `avatar_path` | Patient identification, scheduling, emergency contact | Name/email required; extended fields optional | Owner, `ADMIN`, `RECEPTIONIST`, assigned `DENTIST` |
| Sensitive Health Context | `medical_alerts` (allergies/conditions), `treatment_records` (diagnosis, procedure notes, FDI tooth chart) | Safe dental care delivery & clinical history | Optional / clinician-recorded | Assigned `DENTIST`, `ADMIN` (audit-logged) |
| Scheduling & Comms | `appointments`, `appointment_status_history`, `notifications`, `email_outbox` (encrypted payload) | Booking lifecycle, reminders, status updates | Required for workflow | Scoped by role & ownership |
| Security & Audit | `audit_logs` (actor, action, entity, IP, User-Agent, metadata) | Accountability, incident investigation | System-generated | `ADMIN` (`audit_logs.view`) |

---

## 2. Technical Privacy Safeguards Implemented

1. **Ownership & Role Scoping:** Backend enforces strict patient ownership on `/patients/me*`, `/patients/{id}*`, `/users/{id}/avatar`, `/appointments/*`, and `/notifications/*`.
2. **Email Outbox Payload Encryption:** `email_outbox.payload_json` supports encrypted payload storage (`EMAIL_PAYLOAD_KEY`) so sensitive appointment/verification details are not stored in plaintext in the queue.
3. **Log Redaction (Phase 18 Hardened):** `Logger::redact()` masks passwords, password hashes, session IDs, tokens, SMTP/API secrets, and clinical fields (`clinical_notes`, `treatment_notes`, `diagnosis`, `medical_history`, `medical_alerts`, `allergies`).
4. **No Automatic Deletion of Clinical Records:** No automated hard-deletion job exists for patients or treatment records; clinical and audit records are preserved pending an institutionally approved retention schedule.

---

## 3. Philippine Data Privacy Act of 2012 (RA 10173) — Technical Alignment & Institutional Review Items

ToothCare Hub handles **Sensitive Personal Information (SPI)** (health/clinical records) under Republic Act No. 10173 (Philippine Data Privacy Act of 2012) and its Implementing Rules and Regulations (IRR).

### Items Requiring Formal Institutional / DPO Approval Before Real Patient Use
- [ ] Designate a formal **Data Protection Officer (DPO)** and publish verified clinic contact details.
- [ ] Approve the **Privacy Notice** (collection purposes, legal basis/consent, data sharing with SMTP/hosting providers, retention periods, and data subject rights: access, correction, objection, erasure/blocking, portability, and NPC complaint channel) and integrate it into registration/booking flows.
- [ ] Approve formal **Retention & Disposal Schedules** for patient profiles, dental treatment records, appointments, audit logs, and encrypted backups (aligned with applicable Philippine health/dental recordkeeping rules).
- [ ] Execute **Data Sharing / Outsourcing Agreements** with any external SMTP, cloud hosting, or backup storage providers.
- [ ] Complete a formal **Privacy Impact Assessment (PIA)** and National Privacy Commission (NPC) registration review if applicable.
