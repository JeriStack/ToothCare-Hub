# Patient Registration Welcome Email Automation (Phase 13 Extension)

## Overview

This module extends ToothCare Hub's existing **Phase 13 transactional email infrastructure** (PHPMailer + MySQL `email_outbox` + `EmailOutboxWorker` + Mailpit) to automate patient onboarding communications across three distinct lifecycle stages:

1. **Patient Registration Acknowledgment** (`PATIENT_REGISTRATION_RECEIVED` / `patient-registration-received`) — queued atomically when a patient account is created and committed.
2. **Patient Email Verification** (`EMAIL_VERIFICATION` / `verify-email`) — queued atomically alongside registration acknowledgment using ToothCare Hub's existing SHA-256 hashed, single-use, time-limited verification tokens (`auth_tokens`).
3. **Patient Welcome Email** (`PATIENT_WELCOME` / `patient-welcome`) — queued atomically strictly upon the verified transition (`email_verified = 0 -> 1`) for `PATIENT` accounts only.

## Architectural Guarantees

- **Zero Separate Email Systems**: Reuses `EmailOutboxService`, `EmailOutboxRepository`, `EmailTemplateRenderer`, `EmailOutboxWorker`, `EmailService`, `PhpMailerTransport`, `PayloadCipher`, and `toothcare-mailpit`.
- **Zero New Database Tables**: Uses the existing `email_outbox` table (`UNIQUE (event_key)`) and `auth_tokens` table.
- **Transactional Outbox Decoupling**: Account creation and email verification never block on SMTP availability and never send emails inside open database transactions.
- **At-Least-Once Delivery Semantics**: Delivery is processed asynchronously by `toothcare-email-worker` with exponential retry backoff and stale lock recovery. Note that SMTP server acceptance confirms transport handoff only and does **not** guarantee delivery into an external recipient's inbox (e.g., spam filtering or downstream bounces). If a worker crashes in the narrow window after SMTP acceptance but before recording `SENT`, lock recovery may deliver a duplicate message (standard at-least-once outbox behavior).

## Documentation Index

- [Email Workflow & Lifecycle](email-workflow.md) — Triggers, state transitions, role guards, and sequence diagrams.
- [Email Templates](email-templates.md) — Branded HTML and plain-text template architecture, copy standards, and variables.
- [Outbox Integration](outbox-integration.md) — Event types, idempotency keys, payload encryption/scrubbing, and retry policy.
- [Mailpit Local Testing](mailpit-testing.md) — End-to-end local verification with Docker Compose and `toothcare-mailpit`.
- [Security & Privacy](security-and-privacy.md) — Token protection, XSS/header injection prevention, anti-enumeration, and data minimization.
- [Testing Guide](testing.md) — Automated PHPUnit, Vitest, and manual QA verification suites.
- [Troubleshooting](troubleshooting.md) — Common failure modes, OPcache/worker reloads, and operational recovery.
