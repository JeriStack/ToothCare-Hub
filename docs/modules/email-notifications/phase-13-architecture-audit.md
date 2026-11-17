# Phase 13 Architecture Audit: Email Notifications and Outbox

Audit date: 2026-11-17. Scope: backend email, outbox, worker, reminder, Docker, CI, and admin surfaces as found in the repository before Phase 13 work began.

> Location note: the request named `docs/phase-13/`. The documentation was reorganized into topic folders (see `docs/README.md`), so Phase 13 lives in `docs/modules/email-notifications/`.

## 1. Baseline

- PHP 8.5.12, Composer, PHPUnit 11.5. Baseline test run before changes: **240 tests, 1394 assertions, all passing** (SQLite in-memory test database via `tests/Support/TestDb.php`).
- `phpmailer/phpmailer ^6.9` is already in `composer.json` and installed in `vendor/`. No installation step was needed.
- MySQL 8 runs in Docker (`toothcare-mysql`, healthy), so migrations can be validated against the real engine.
- The frontend is React with plain JSX (no TypeScript), as documented in `docs/design/ui-ux/responsive-design-guidelines.md`. Phase 13 follows the existing JSX conventions.

## 2. Existing email-related implementation

| Component | State found | Assessment |
|---|---|---|
| `backend/src/Services/EmailService.php` | Builds HTML and text bodies inline with string concatenation and inserts rows into `email_outbox` using its own `INSERT`. Despite the name, it never sends mail. | Works as an enqueue facade. Bodies (including raw verification and reset token URLs) are stored in the outbox. Insert errors are swallowed and return `false`. |
| `backend/src/Jobs/ProcessEmailOutbox.php` | Polling loop that counts `status = 'pending'` rows (lowercase) and prints a message. It never claims, renders, sends, or updates a row. Opens its own PDO with hardcoded credential defaults. | Stub. Nothing is delivered today. The status literal does not match the `PENDING` enum. |
| `backend/src/Jobs/SendAppointmentReminders.php` | Empty file. | Missing. |
| `backend/src/Repositories/EmailOutboxRepository.php` | Empty file. | Missing. |
| `backend/templates/emails/*.php` (6 files) | All empty. | Missing. |
| `backend/config/mail.php` | Reads `MAIL_*` values with `Config::getString`. Not used by any code. | Replaced by a validated `MailConfig`. |
| PHPMailer | Declared in `composer.json`, never instantiated. | Needs a mailer factory and transport. |
| `.env.example` | Has `MAIL_MAILER/HOST/PORT/USERNAME/PASSWORD/ENCRYPTION/FROM_*`. Defaults point at `mailpit:1025` with `MAIL_ENCRYPTION=tls`. | `tls` is wrong for a Mailpit sink. Missing `MAIL_ENABLED`, `MAIL_REPLY_TO_ADDRESS`, `MAIL_TIMEOUT`, `MAIL_VERIFY_PEER`, worker and retry settings. |
| Mailpit service | Referenced by env defaults, not defined in `compose.yaml`. | Add to `compose.dev.yaml`. |

## 3. Existing outbox and queue structures

- `email_outbox` (migration 012): `user_id`, `recipient_*`, `subject`, `body_html`, `body_text`, `status ENUM('PENDING','PROCESSING','SENT','FAILED_RETRYABLE','FAILED_PERMANENT')`, `attempts`, `max_attempts`, `last_error`, `next_attempt_at`, `sent_at`, timestamps. Queue index `(status, next_attempt_at, attempts)`. No idempotency key, no worker lock columns, no event type, no template key, no appointment link.
- `outbox` (migration 022): a generic domain-event table (`aggregate_type`, `aggregate_id`, `event_type`, `payload JSON`, `status`). Nothing reads or writes it. It is not used for email. Phase 13 reuses `email_outbox` and leaves `outbox` untouched.
- `notifications` (migration 011) and `NotificationService`: in-app notifications, separate concern. Reused as is.
- Status naming convention is uppercase (`PENDING`, `FAILED_RETRYABLE`). Phase 13 keeps it.

## 4. Transaction boundaries (key finding)

`AppointmentService` already uses explicit transactions with row locking for booking, confirm, reject, cancel, complete, and reschedule. Email enqueueing happens **after `commit()`** in every case:

- book (`bookAppointment`), confirm, reject, cancel, complete (admin), complete (dentist).
- Consequence: a crash or DB error between commit and enqueue silently loses the notification, which violates the transactional outbox guarantee.
- Reschedule sends no email at all (only an in-app notification).

`AuthService` is mixed:

- `register()` calls `sendVerificationEmail()` **inside** the transaction, but the enqueue helper catches every exception, so an outbox failure cannot roll back the registration, and a failure leaves the user without a verification email.
- `resendVerification()` and `forgotPassword()` enqueue outside any transaction.

Other findings:

- All repositories share one PDO from `Database::getInstance()`, so an enqueue call made before `commit()` participates in the active transaction.
- Raw verification and password-reset tokens are written into `body_html`/`body_text` in the outbox and persist there after sending. This conflicts with the Phase 13 privacy requirement.
- Status history rows have an auto-increment id returned by `recordStatusHistory()`, which gives a stable business-event identity for idempotency keys.

## 5. Scheduled and worker infrastructure

- `compose.yaml` defines `email-worker` (reuses `toothcare-php-fpm:latest`, command `php src/Jobs/ProcessEmailOutbox.php`, health check disabled, `restart: unless-stopped`) and `db-backup` (a shell loop acting as cron). There is no reminder scheduler.
- The worker container does not receive `MAIL_*` variables except through `env_file`.
- Prometheus and Grafana exist under `monitoring/`. `MetricsController::metrics()` returns a placeholder comment only, so no application metrics exist yet.

## 6. Authorization and audit

- DRBAC tables exist (migrations 017, 024). `AuthorizationMiddleware::hasPermission(slug, fallbackRoles)` guards routes. The `admin` role is granted every permission by migration 024 through a `CROSS JOIN`. New permissions need their own migration and an explicit grant.
- `AuditLogRepository::record(action, targetType, targetId, actorUserId, ip, userAgent, payload)` sanitizes keys such as `password`, `token`, `secret`.
- System health UI: `frontend/src/features/system/pages/SystemHealthPage` gated by `system.health` or `settings.manage`.

## 7. CI/CD

- `.github/workflows/ci.yml` runs Compose validation, `composer validate`, install, PHP lint, PHPUnit, OpenAPI validation, and frontend tests/build. It has no migration validation and no worker command check.

## 8. Reusable components

- `Database`, `Config`, `Logger`, `HttpException`, `Request`/`Response`, `AuditLogRepository`, `NotificationService`, `AuthTokenRepository`, `ClinicSettingsRepository`, the DRBAC middleware, and `TestDb` all stay as is.
- PHPMailer and PHPUnit are already installed.

## 9. Missing functionality

1. Validated mail configuration and a PHPMailer factory.
2. A real sender service and a transport abstraction for test doubles.
3. Template rendering with escaping and text alternatives.
4. Outbox schema for idempotency, locking, retry metadata, template-based payloads.
5. Atomic enqueue inside business transactions.
6. A worker that claims, sends, retries, and recovers.
7. Retry policy and failure classification.
8. Reminder scheduler.
9. Admin visibility, DRBAC permissions, audit of retries.
10. Prometheus metrics, Compose wiring, CI checks, documentation.

## 10. Potential architectural conflicts

| Conflict | Resolution |
|---|---|
| Existing `App\Services\EmailService` name collides with the requested sender service. | Move the enqueue facade to `App\Services\Email\EmailOutboxService` (same public method names) and create `App\Services\Email\EmailService` as the sender. |
| Legacy rows hold pre-rendered `body_html`/`body_text`. | Keep columns, make them nullable. The worker sends legacy rows as stored and renders template rows at send time. |
| Verification and reset emails need the raw token at send time, but the outbox must not hold it in plain text. | Store the token AES-256-GCM encrypted inside `payload_json`, using a dedicated key (`EMAIL_PAYLOAD_KEY`), and remove it from the row after a successful send. The database holds only the token hash. |
| Tests run on SQLite, which has no `SKIP LOCKED` or `JSON` type. | Claim jobs with a guarded `UPDATE ... WHERE id = ? AND status IN (...)` and a row-count check, which is correct on both engines. Use `FOR UPDATE SKIP LOCKED` only on MySQL to reduce contention. |
| Mixed `NOW()` and PHP `date()` timestamps (MySQL timezone vs `Asia/Manila`). | The outbox writes and compares all times using timestamps supplied by PHP in the clinic timezone. |
| Reminder policy is not defined in existing documents. | Add a configurable `reminder_lead_hours` clinic setting with default 24. Flagged for clinic approval. |

## 11. Recommended changes

See `email-architecture.md` and `phase-13-implementation-report.md` for the resulting design and verification status.
