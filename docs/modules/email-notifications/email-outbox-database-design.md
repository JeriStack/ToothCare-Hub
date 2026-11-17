# Email Outbox Database Design

Phase 13 extends the existing `email_outbox` table from migration 012. It does not create a duplicate table. The unrelated generic `outbox` table from migration 022 is left untouched.

## Migrations

| File | Change |
|---|---|
| `database/migrations/029_extend_email_outbox.sql` | Additive `ALTER TABLE`: new columns, nullable bodies, `CANCELLED` status, JSON check, appointment FK, unique event key, worker indexes. Existing rows and columns are kept. |
| `database/migrations/030_email_outbox_permissions_and_reminder_setting.sql` | Four `email_outbox.*` permissions granted to the `admin` role only; `reminder_lead_hours` clinic setting (default 24). |
| `database/migrations/rollback/029_extend_email_outbox.down.sql` | Manual rollback. It drops only the Phase 13 columns and indexes. Run it only after the pre-check in the file. |

Validated on MySQL 8.0.46: applied to a copy of the live schema, rolled back, reapplied, applied to the live development database, and applied from scratch together with all earlier migrations (30 of 30 succeeded).

## Columns (after migration 029)

| Column | Type | Purpose |
|---|---|---|
| `id` | BIGINT UNSIGNED PK | Job id (shown to admins as `EML-000123`) |
| `event_key` | VARCHAR(191) NULL, UNIQUE | Logical event / idempotency key. NULL for legacy rows. |
| `event_type` | VARCHAR(64) NULL | e.g. `APPOINTMENT_CONFIRMED` |
| `template_key` | VARCHAR(64) NULL | Approved template. NULL means a legacy pre-rendered row. |
| `payload_json` | JSON NULL, `CHECK (JSON_VALID)` | Minimal template data; `secure` holds sealed token data |
| `user_id` | FK users, ON DELETE SET NULL | Existing |
| `appointment_id` | FK appointments, ON DELETE SET NULL | Reminder invalidation and admin context |
| `recipient_email`, `recipient_name`, `subject` | | Existing |
| `body_html`, `body_text` | now NULL | Only legacy rows use them. New rows are rendered at send time. |
| `status` | ENUM | `PENDING`, `PROCESSING`, `SENT`, `FAILED_RETRYABLE`, `FAILED_PERMANENT`, `CANCELLED` |
| `attempts`, `max_attempts` | TINYINT UNSIGNED | Claimed attempts and their limit |
| `next_attempt_at` | DATETIME | Earliest eligible time (the "available_at") |
| `locked_at`, `locked_by` | | Worker claim time and owner |
| `sent_at`, `failed_at` | | Terminal timestamps |
| `last_error`, `last_error_code`, `failure_category` | | Sanitized message, code (e.g. `SMTP_TIMEOUT`), `TEMPORARY`/`PERMANENT`/`UNKNOWN` |
| `created_at`, `updated_at` | | Existing |

Times written by Phase 13 code come from PHP in the clinic time zone (`Asia/Manila`), so every comparison uses one clock.

## Indexes

| Index | Supports |
|---|---|
| `uq_email_outbox_event_key` | Idempotent insert |
| `idx_email_outbox_claim (status, next_attempt_at, id)` | Pending and retry claim query |
| `idx_email_outbox_locks (status, locked_at)` | Expired lock recovery |
| `idx_email_outbox_appointment (appointment_id, event_type, status)` | Reminder invalidation |
| `idx_email_outbox_event_type (event_type, status)` | Metrics and filtering |
| `idx_email_outbox_failures (status, failed_at)` | Exhausted-job monitoring |
| existing `idx_email_outbox_queue`, `idx_email_outbox_created_at` | Kept |

## State model

```
PENDING ──claim──> PROCESSING ──success──────────────> SENT
   ^                   │  ├─temporary/unknown, attempts left─> FAILED_RETRYABLE ──(next_attempt_at)──> claim
   │                   │  ├─permanent, or attempts exhausted─> FAILED_PERMANENT
   │                   │  └─reminder no longer valid─────────> CANCELLED
   │                   └─lock expired─> FAILED_RETRYABLE (or FAILED_PERMANENT if exhausted)
   └── admin retry / requeue (FAILED_* only) ── admin abandon ──> FAILED_PERMANENT
PENDING / FAILED_RETRYABLE ──reminder invalidated──> CANCELLED
```

These are delivery states only. They are independent of appointment statuses.

## What is not stored

SMTP credentials, raw tokens in plain text, rendered bodies for new rows, chief complaints, diagnoses, notes, or session data.
