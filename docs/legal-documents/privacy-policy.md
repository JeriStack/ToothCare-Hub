# Privacy Policy — DRAFT — NOT APPROVED FOR PRODUCTION

> **WARNING:** `DRAFT — NOT APPROVED FOR PRODUCTION`  
> Document Version: `1.0` | Initial Effective Date (Draft): `2026-11-23` | Approval Status: `PENDING CLINIC APPROVAL` & `PENDING LEGAL/PRIVACY REVIEW`

This draft describes only data categories and security safeguards verified in the actual ToothCare Hub codebase and MySQL schema. It must be reviewed by the clinic's designated Data Protection Officer (DPO) and qualified Philippine privacy counsel against the **Data Privacy Act of 2012 (Republic Act No. 10173)** and applicable **National Privacy Commission (NPC)** issuances before production release.

## Verified Data Categories Collected by ToothCare Hub

1. **Account & Identification (`users`)**: `first_name`, `last_name`, `email`, `password_hash`, `role`, `is_active`, `email_verified`, `email_verified_at`, optional `avatar_path` / `avatar_mime`.
2. **Patient Contact & Demographics (`patients`)**: `date_of_birth`, `phone`, `gender`, optional `address`, optional `emergency_contact_name`, optional `emergency_contact_phone`.
3. **Appointment & Service Records (`appointments`, `appointment_status_history`, `appointment_attendances`)**: selected `service_id`, `dentist_id`, `start_at`, `end_at`, `duration_snapshot`, `price_snapshot`, `status`, `operatory_chair`, `cancellation_reason`, check-in/consultation timestamps.
4. **Health-Related Personal Information (`patients.medical_alerts`, `appointments.chief_complaint`, `treatment_records`)**: optional patient-disclosed allergies/medical alerts, chief complaints, and dentist-authored `teeth_treated`, `diagnosis`, `procedure_notes`, `prescription_notes`, `home_care_advice`.
5. **Notifications & Transactional Emails (`notifications`, `email_outbox`)**: transactional account verification, password reset, and appointment lifecycle notices only (no bundled marketing).
6. **Authentication, Audit & Legal Acceptance Metadata (`auth_tokens`, `realtime_tickets`, `rate_limits`, `audit_logs`, `user_legal_acceptances`)**: HttpOnly session cookie (`toothcare_session`), SHA-256 hashed single-use tokens/tickets, rate-limit counters, append-only audit logs with credential redaction, and immutable legal acceptance records (`document_id`, `document_type`, `document_version`, `acceptance_action`, server-generated `accepted_at`, `ip_address`, `user_agent`).

## Verified Technical Safeguards (Accurate Claims Only)

- Passwords hashed with PHP `password_hash()`.
- Verification, password reset, and WebSocket tickets stored as SHA-256 hashes; outbox token payloads encrypted at rest prior to delivery and scrubbed after send.
- HttpOnly, SameSite session cookies + synchronizer CSRF tokens on state-changing requests.
- Parameterized PDO queries, server-side DRBAC, resource ownership checks, and rate limiting.
- **Not claimed**: General demographic/clinical database columns are not claimed to have application-level column encryption unless configured at the hosting layer; no automatic record purging is implemented.

## Pending Legal / Privacy Review Items

- Legal clinic entity identity (Personal Information Controller) and designated DPO contact details.
- Approved lawful basis per processing activity under RA 10173 Sections 12 and 13.
- Clinic retention schedule and secure disposal procedures.
- Named hosting and SMTP processors and executed data sharing/processing agreements.
- Verified workflow and SLA for Data Subject Rights requests.
