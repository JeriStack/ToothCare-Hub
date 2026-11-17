# Email Testing Guide

Automated tests never send email. Every test injects `Tests\Support\FakeMailTransport` (an in-memory `MailTransportInterface`) or never constructs a transport. CI runs PHPUnit with `MAIL_ENABLED=false` and an empty `MAIL_HOST` as a second safeguard.

## Running

```
cd backend
vendor/bin/phpunit                                       # everything
vendor/bin/phpunit --filter 'Email|MailConfig|PayloadCipher|OutboxSettings'
vendor/bin/phpunit tests/Integration/EmailOutboxFlowTest.php
cd ../frontend && npx vitest run src/tests/admin/EmailDeliveryPanel.test.jsx
```

## Suites

| File | Covers |
|---|---|
| `tests/Unit/MailConfigTest.php` | Validation, disabled mode, production TLS rule, no credential leakage via `describe`/`print_r` |
| `tests/Unit/EmailServiceTest.php` | Success, invalid recipient, header injection, classified and sanitized failures, disabled mail |
| `tests/Unit/EmailTemplateRendererTest.php` | All 8 templates, HTML escaping, text alternative, token links, missing data, unknown and traversal keys, clinical fields never rendered |
| `tests/Unit/EmailRetryPolicyTest.php` | Backoff schedule, jitter bounds, exhaustion, classification table |
| `tests/Unit/PayloadCipherTest.php` | Round trip, wrong key, malformed value, production key requirement |
| `tests/Unit/OutboxSettingsTest.php` | Defaults, bounds, invalid values |
| `tests/Integration/EmailOutboxFlowTest.php` | Booking/confirm/reject/cancel/complete plus outbox atomicity, rollback on outbox failure, no orphan on a failed transition, idempotency, registration plus verification atomicity, token encryption and scrubbing, logs free of tokens and recipients, worker success/retry/backoff/permanent/exhausted/malformed/missing template/legacy rows, concurrent claims, lost-lock writes ignored, lock recovery, requeue/abandon, reminders (window, Manila midnight, setting override, cancellation, in-place reschedule, revalidation before send, no resend, concurrent scheduling) |
| `tests/Integration/EmailOutboxAdminApiTest.php` | DRBAC (no admin fallback, other roles denied, unauthenticated), stats, masking, no payload or credential exposure, audit records, retry/requeue/abandon rules, concurrent retry, metrics labels |
| `frontend/src/tests/admin/EmailDeliveryPanel.test.jsx` | Metrics, masked failures, retry, exhausted confirmation, 403 handling, misconfiguration display |

## Failure simulation

`FakeMailTransport::timeout()`, `refused()`, `tempReject()` (451), `badRecipient()` (550), `failNext(...)`, `failAlways(...)`. Worker crash: claim with a different worker id and advance the clock past the lock timeout. Malformed payloads and missing templates: insert rows directly. Duplicate scheduler: call `queueReminder` twice. Database interruption is covered by the rollback tests, where the outbox insert throws inside the business transaction.

## Manual end-to-end (performed during Phase 13)

1. `docker compose --profile mail up -d mailpit email-worker reminder-scheduler`
2. Log in as the demo patient, book through the API, and confirm as the admin.
3. Check Mailpit for "We received your appointment request" and "Your appointment is confirmed". Confirm the body has the reference, service, dentist and Manila time, and no chief complaint.
4. `docker stop toothcare-mailpit`, cancel the appointment: the API returns `CANCELLED`, and the job becomes `FAILED_RETRYABLE / SMTP_CONNECTION_FAILED` with a retry about 60 s later.
5. `docker start toothcare-mailpit`: the job is `SENT` on attempt 2.

MySQL-specific behavior (`SKIP LOCKED`, JSON check, unique key, `GET_LOCK`, requeue SQL) was checked with a throwaway script against MySQL 8.0.46. The SQLite test database cannot exercise these paths.
