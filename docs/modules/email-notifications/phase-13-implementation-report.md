# Phase 13 Implementation Report: Email Notifications, PHPMailer and Transactional Outbox

Date: 2026-11-17. Environment: Windows host with PHP 8.5.12 CLI; Docker stack with MySQL 8.0.46 and the `toothcare-php-fpm` image (PHP 8.5.12).

Status values: PASSED (behavior verified by an executed test or command), FAILED, BLOCKED, NOT YET IMPLEMENTED, NOT APPLICABLE.

## 1. Results by requirement

| # | Area | Status | Evidence |
|---|---|---|---|
| 1 | Repository audit | PASSED | `phase-13-architecture-audit.md` |
| 2 | Reuse existing email infrastructure | PASSED | Extended `email_outbox` (no new table), reused PHPMailer, `Database`, `Config`, `Logger`, `AuditLogRepository`, DRBAC, `auth_tokens`, `email-worker` service and PHP image |
| 3 | PHPMailer installation | PASSED | Already present: `phpmailer/phpmailer ^6.9` in `composer.json`/`composer.lock`. No install needed. |
| 4 | SMTP configuration | PASSED | `MailConfig` + `MailConfigTest` (7 tests) |
| 5 | EmailService architecture | PASSED | `EmailServiceTest` (5 tests) |
| 6 | Templates (6 required + password reset, completion) | PASSED | `EmailTemplateRendererTest` (18 cases); live Mailpit render checked |
| 7 | Migrations and schema | PASSED | 029/030 applied to live dev DB; full 30-migration run on an empty MySQL 8 DB; rollback tested on a schema copy |
| 8 | Transactional outbox integration | PASSED | `EmailOutboxFlowTest` atomicity and rollback tests; live API booking/confirm/cancel |
| 9 | Worker | PASSED | 13 worker tests, live delivery, MySQL `SKIP LOCKED` check, graceful SIGTERM (0.3 s) |
| 10 | Retry and failure classification | PASSED | `EmailRetryPolicyTest` (15 cases); live SMTP outage retried and delivered on attempt 2 |
| 11 | Reminder scheduling | PASSED, policy pending | 10 reminder tests; the 24-hour default needs clinic approval |
| 12 | Email verification integration | PASSED | Registration, resend and forgot-password now enqueue in one transaction with the token. Existing Phase 7 token rules unchanged. |
| 13 | Admin operational interface | PASSED | `EmailDeliveryPanel` on System Health + 7 Vitest tests |
| 14 | DRBAC permissions | PASSED | `EmailOutboxAdminApiTest` (no admin fallback, other roles denied) |
| 15 | Audit trail | PASSED | View, retry, requeue and abandon audited; no payloads in audit rows (tested) |
| 16 | Docker and scheduler | PASSED | `email-worker` (new command, health check), new `reminder-scheduler`, Mailpit profile; `docker compose config` valid for base, dev, prod |
| 17 | Logging and monitoring | PASSED | Log content test (no tokens, recipients or bodies); `/api/v1/metrics` output; `promtool check config` succeeded |
| 18 | PHPUnit | PASSED | 350 tests, 1999 assertions, 0 failures |
| 19 | CI/CD | PASSED locally, not yet run on GitHub | New steps executed in the PHP container; workflow not yet triggered remotely |
| 20 | Frontend build and tests | PASSED | `npm test`: 36 files / 202 tests; `npm run build` succeeded |

## 2. Audit findings (summary)

Before Phase 13, nothing was delivered. `ProcessEmailOutbox.php` only counted rows, using a lowercase status that matches no row. `SendAppointmentReminders.php`, `EmailOutboxRepository.php` and all six template files were empty. Appointment emails were enqueued **after** commit, so a crash in between lost them. Registration swallowed enqueue errors. Raw verification and reset tokens were stored in plain-text bodies. Details are in the audit document.

## 3. What changed

**Created (backend):** `src/Services/Email/` with `DeliveryResult`, `EmailFactory`, `EmailMessage`, `EmailOutboxService`, `EmailOutboxWorker`, `EmailRetryPolicy`, `EmailService`, `EmailTemplateRenderer`, `MailConfig`, `MailTransportException`, `MailTransportInterface`, `MailerFactory`, `OutboxJobException`, `OutboxSettings`, `PayloadCipher`, `PhpMailerTransport`, `ReminderScheduler`; `src/Controllers/EmailOutboxController.php`; `bin/email-worker.php`; `bin/schedule-reminders.php`; templates `password-reset.php`, `appointment-completed.php`.

**Implemented (previously empty):** `src/Repositories/EmailOutboxRepository.php`; templates `verify-email`, `appointment-requested`, `appointment-confirmed`, `appointment-rejected`, `appointment-cancelled`, `appointment-reminder`.

**Modified:** `AppointmentService` (enqueue moved inside the 6 transactional operations, plus reschedule acknowledgement and reminder invalidation), `AuthService` (transactional verification and reset enqueue), `MetricsController` (email metrics), `Routes/api.php` (5 admin routes), `.env.example` (mail and worker variables), `tests/Support/TestDb.php` and `AppointmentConcurrencyTest.php` (test schema matches migration 029).

**Removed (replaced):** `src/Services/EmailService.php` (the enqueue facade, now `Email\EmailOutboxService`), `src/Jobs/ProcessEmailOutbox.php` (stub), `src/Jobs/SendAppointmentReminders.php` (empty), `config/mail.php` (unused, replaced by `MailConfig`).

**Database:** `029_extend_email_outbox.sql`, `030_email_outbox_permissions_and_reminder_setting.sql`, `rollback/029_extend_email_outbox.down.sql`.

**Infrastructure:** `compose.yaml` (worker command, SIGTERM handling, health check, separate log file; new `reminder-scheduler`; `mailpit` under profile `mail`), `compose.dev.yaml`, `compose.prod.yaml`, `docker/php/Dockerfile` (`pcntl`), Prometheus job `toothcare-api`, 3 alert rules, 2 Grafana panels, `.github/workflows/ci.yml` (lint `bin`/`templates`, mail disabled for PHPUnit, worker/settings/template checks, new MySQL migration job).

**Frontend:** `features/system/emailOutboxApi.js`, `features/system/components/EmailDeliveryPanel.jsx`, `SystemHealthPage.jsx` (panel mounted), `tests/admin/EmailDeliveryPanel.test.jsx`, rebuilt `frontend/dist/index.html`.

**Tests added:** 6 unit test files, 2 integration test files, 1 fake transport, 1 Vitest file: 110 new PHPUnit tests and 7 Vitest tests.

## 4. Migrations applied

| Target | Result |
|---|---|
| Copy of live schema (`p13_scratch`) | 029 + 030 applied; rollback applied and verified; 029 reapplied |
| Live development DB `toothcare_hub` | 029 + 030 applied and recorded in `schema_migrations` (batch 8). A pre-migration encrypted backup was created first (`backups/pre-migration/toothcare_hub_pre_migration_batch_7_2026-11-17_09-35-03.sql.gz.enc`). 4 existing outbox rows kept. |
| Empty database | All 30 migrations applied in order by `database/migrate.php` |

The live database could not be migrated with `migrate.php`. Its ledger lacks entries for 023, 024 and 026, although those changes are already present (026 fails with "Duplicate column avatar_path"). This mismatch predates Phase 13. Migrations 029 and 030 were therefore applied directly with the MySQL client and recorded in the ledger. **Recommendation:** reconcile `schema_migrations` for 023, 024 and 026 so that `migrate.php` works again on this database.

## 5. Commands and tests executed

| Command | Result |
|---|---|
| `vendor/bin/phpunit` (baseline, before changes) | OK, 240 tests, 1394 assertions |
| `vendor/bin/phpunit` (final) | OK, 350 tests, 1999 assertions (Unit 191, Integration 159) |
| `npm test -- --run` | 36 files, 202 tests passed |
| `npm run build` | built |
| `docker compose -f compose.yaml [-f compose.dev.yaml / compose.prod.yaml] config -q` | all valid |
| `promtool check config` | config and 7 rules valid |
| CI steps in the PHP container (lint 159 files, `--help`, settings, templates, OpenAPI) | all passed |
| MySQL check script (13 checks: unique key, JSON check, rollback, FK, `SKIP LOCKED` non-blocking, disjoint claims, requeue SQL, advisory lock, cleanup) | 13/13 passed |
| Live E2E: patient booking → admin confirm → Mailpit | 2 jobs created atomically and delivered; body contains reference, service, dentist, Manila time; no chief complaint |
| Live SMTP outage: Mailpit stopped, 2 cancellations | API returned `CANCELLED`; jobs `FAILED_RETRYABLE / SMTP_CONNECTION_FAILED`; after restart both `SENT` on attempt 2 |
| `docker stop toothcare-email-worker` | `Signal 15 received; finishing current batch` (0.3 s) |

**Test data created on the dev database:** appointments 1056 and 1057 (demo patient, 2026-11-23 09:00 and 09:45) were booked, confirmed and then cancelled through the API. Six emails went to the local Mailpit sink. Mailpit also received the two pre-existing `PENDING` seed rows (to `patient@toothcare.com`).

## 6. Required environment variables

`MAIL_ENABLED`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO_ADDRESS`, `MAIL_TIMEOUT`, `MAIL_VERIFY_PEER`, `EMAIL_PAYLOAD_KEY` (required in production), `EMAIL_WORKER_ENABLED`, `EMAIL_WORKER_BATCH_SIZE`, `EMAIL_WORKER_MAX_ATTEMPTS`, `EMAIL_WORKER_LOCK_TIMEOUT`, `EMAIL_WORKER_SLEEP_SECONDS`, `EMAIL_RETRY_DELAYS`, `EMAIL_RETRY_JITTER`, `EMAIL_REMINDER_LEAD_HOURS`, `REMINDER_SCHEDULER_INTERVAL_SECONDS` (compose). See `smtp-configuration-guide.md`.

## 7. Manual deployment steps

1. Rebuild the PHP image (it now includes `pcntl`): `docker compose build php-fpm`.
2. Back up, then apply migrations 029 and 030.
3. Set the production secrets: SMTP credentials and `EMAIL_PAYLOAD_KEY`. Keep `MAIL_VERIFY_PEER=true`.
4. `docker compose -f compose.yaml -f compose.prod.yaml up -d php-fpm email-worker reminder-scheduler`, then restart nginx so it resolves the new php-fpm container.
5. Check: `docker exec toothcare-email-worker php bin/email-worker.php --status`.
6. Confirm the reminder lead time with the clinic. Change it with `UPDATE clinic_settings SET setting_value='<hours>' WHERE setting_key='reminder_lead_hours'`.
7. If admins other than the `admin` role need access, assign the `email_outbox.*` permissions through the DRBAC matrix.

## 8. Known limitations and risks

- **Reminder policy not approved.** The 24-hour default is a placeholder pending the clinic's decision.
- **`/api/v1/metrics` is reachable through the public nginx port.** This route existed before Phase 13. It now returns real email counts. Labels contain no personal data, but the endpoint should be restricted to the monitoring network in production. Not changed here, because it would alter existing routing.
- **Existing Prometheus job `toothcare-backend` targets `backend:9000`.** No host has that name, and port 9000 is FastCGI, so the job cannot scrape. It was left as is, and a working `toothcare-api` job was added.
- **`compose.dev.yaml` together with `compose.yaml` publishes MySQL port 3306 twice** (`0.0.0.0` and `127.0.0.1`), so the dev override cannot start MySQL. This conflict predates Phase 13. The running stack uses `compose.yaml` only, and Mailpit was placed there under a profile for that reason.
- **Migration ledger drift** on the live dev database (section 4).
- **Admin UI permission visibility.** The backend does not send permission slugs to the frontend, so the panel renders for the ADMIN role and relies on 403 responses (handled with messages) when a permission is missing.
- **OpenAPI annotations** for the 5 new admin endpoints were not added. `validate-openapi.php` still passes.
- **`database/schema.sql`** (the snapshot) was not regenerated. The migrations are the source of truth.
- **CI not yet run on GitHub Actions.** The steps were executed locally only.
- **Average delivery delay** includes legacy seed rows with old `created_at` values, so the dev figure (about 182,000 s) is inflated until new traffic dominates the last 200 sent jobs.
