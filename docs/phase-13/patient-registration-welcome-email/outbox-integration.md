# Transactional Outbox Integration

Patient registration emails reuse the existing `email_outbox` table and `EmailOutboxService` / `EmailOutboxWorker` pipeline without introducing new tables or duplicate workers.

## Event Types & Idempotency Keys

| Event Constant | `event_type` | `template_key` | `event_key` (UNIQUE) |
|---|---|---|---|
| `EmailOutboxService::EVENT_REGISTRATION_RECEIVED` | `PATIENT_REGISTRATION_RECEIVED` | `patient-registration-received` | `patient-registration:{user_id}` |
| `EmailOutboxService::EVENT_VERIFICATION` | `EMAIL_VERIFICATION` | `verify-email` | `user:{user_id}:email_verify:{token_id}` |
| `EmailOutboxService::EVENT_PATIENT_WELCOME` | `PATIENT_WELCOME` | `patient-welcome` | `patient-welcome:{user_id}` |

Because `email_outbox.event_key` carries a database `UNIQUE` constraint and `EmailOutboxRepository::enqueue()` uses `INSERT IGNORE`, duplicate enqueue attempts for the same `user_id` or `token_id` silently return `null` without creating duplicate jobs.

## Atomic Enqueueing & Decoupled Delivery

- `AuthService::register()` enqueues `PATIENT_REGISTRATION_RECEIVED` and `EMAIL_VERIFICATION` inside the same PDO transaction that inserts the user, patient profile, legal consent records, and verification token. If any step fails, the entire transaction rolls back and zero orphaned email jobs remain.
- `AuthService::verifyEmail()` enqueues `PATIENT_WELCOME` inside the same PDO transaction that marks `email_verified = 1` and invalidates remaining `EMAIL_VERIFY` tokens.
- **No SMTP inside transactions**: `EmailOutboxWorker` claims pending rows in a brief lock transaction, then renders and calls `EmailService::send()` outside any open transaction.

## Retry Policy & Failure Classification

Managed by `EmailRetryPolicy` and `OutboxSettings`:

- **Transient failures** (SMTP connection refused, timeout, 4xx temporary deferral): Marked `FAILED_RETRYABLE` with exponential backoff (`EMAIL_RETRY_DELAYS`, default `60,300,900,3600,21600` seconds plus jitter) up to `EMAIL_WORKER_MAX_ATTEMPTS`.
- **Permanent failures** (invalid recipient syntax, 5xx hard bounce, header injection rejection, unknown template): Immediately marked `FAILED_PERMANENT` without infinite retries.
- **Lock recovery**: Stale `PROCESSING` locks older than `EMAIL_WORKER_LOCK_TIMEOUT` are reclaimed automatically on the next batch.

## Delivery Semantics Notice

This outbox provides **at-least-once delivery to the configured SMTP relay**:
1. Recording `SENT` confirms the configured SMTP server accepted the message; it does not guarantee final external mailbox placement (which depends on DNS/SPF/DKIM/DMARC and recipient mail servers).
2. If the worker crashes after SMTP acceptance and before updating `status = 'SENT'`, lock expiry may re-attempt delivery once.
