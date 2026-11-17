# Email Architecture

## Guarantee

**Business transaction → database commit (business rows + outbox job) → independent worker → PHPMailer SMTP.**

SMTP is never contacted inside an HTTP request or a business transaction. A booking, confirmation, rejection, cancellation, completion, reschedule or registration succeeds or fails on database state alone. If its transaction rolls back, its email job rolls back with it.

## Components

All code lives in `backend/src/Services/Email/` unless noted.

| Component | Responsibility |
|---|---|
| `EmailOutboxService` | Enqueues jobs on the shared PDO connection, inside the caller's transaction. Builds idempotency keys. Seals token values. Invalidates obsolete reminders. Throws on failure so the caller rolls back. |
| `Repositories/EmailOutboxRepository` | All SQL for `email_outbox`: idempotent insert, atomic claim, ownership-guarded result updates, lock recovery, requeue/abandon, statistics. |
| `EmailOutboxWorker` | Recovers expired locks, claims a batch, revalidates and renders each job, sends it outside any transaction, and records the outcome. |
| `EmailService` | Sends one rendered `EmailMessage` through a `MailTransportInterface` and returns a sanitized `DeliveryResult`. Validates the recipient and rejects header injection. |
| `PhpMailerTransport` + `MailerFactory` | The only place PHPMailer is built. Applies the validated `MailConfig` (TLS mode, peer verification, timeout, sender, reply-to). Translates PHPMailer errors into `MailTransportException` (reason + SMTP code, no server text). |
| `MailConfig` | Reads and validates `MAIL_*` variables. `describe()` and `__debugInfo()` omit credentials. |
| `OutboxSettings` | Reads and bounds `EMAIL_WORKER_*`, `EMAIL_RETRY_*` and `EMAIL_REMINDER_LEAD_HOURS`. |
| `EmailRetryPolicy` | Failure classification and exponential backoff with jitter. |
| `EmailTemplateRenderer` + `backend/templates/emails/*.php` | Approved templates. They return a content spec, and the renderer escapes every value and produces the HTML and plain-text bodies. |
| `PayloadCipher` | AES-256-GCM sealing for verification and reset tokens held in the outbox until they are sent. |
| `ReminderScheduler` | Queues reminders for confirmed appointments inside the lead window, idempotently, under a MySQL advisory lock. |
| `EmailFactory` | Composition root for the CLI commands. |
| `Controllers/EmailOutboxController` | Admin stats, failure list, job detail, retry/requeue, abandon (DRBAC + audit). |
| `Controllers/MetricsController` | Prometheus email metrics. |
| `bin/email-worker.php`, `bin/schedule-reminders.php` | CLI entry points. |

## Integration points

| Business operation | File / method | Event | Idempotency key |
|---|---|---|---|
| Patient booking | `AppointmentService::bookAppointment` | `APPOINTMENT_REQUESTED` | `appointment:{id}:APPOINTMENT_REQUESTED:{historyId}` |
| Confirmation | `confirmAppointment` | `APPOINTMENT_CONFIRMED` | `appointment:{id}:APPOINTMENT_CONFIRMED:{historyId}` |
| Rejection | `rejectAppointment` | `APPOINTMENT_REJECTED` | same pattern |
| Cancellation | `cancelAppointment` | `APPOINTMENT_CANCELLED` | same pattern |
| Completion (admin and dentist) | `completeAppointment`, `completeDentistAppointment` | `APPOINTMENT_COMPLETED` | same pattern |
| Reschedule | `rescheduleAppointment` | `APPOINTMENT_REQUESTED` for the new appointment; old reminders cancelled | new appointment's history id |
| Registration | `AuthService::register` | `EMAIL_VERIFICATION` | `user:{id}:email_verify:{tokenId}` |
| Resend verification | `AuthService::resendVerification` (now transactional) | `EMAIL_VERIFICATION` | `user:{id}:email_verify:{tokenId}` |
| Forgot password | `AuthService::forgotPassword` (now transactional) | `PASSWORD_RESET` | `user:{id}:password_reset:{tokenId}` |
| Reminder | `ReminderScheduler::run` | `APPOINTMENT_REMINDER` | `appointment:{id}:reminder:{startUnixTime}` |

The status history row id identifies one exact transition. A retried request that repeats the same transition produces the same key, so it inserts nothing. A legitimately new transition produces a new history row and a new key.

The appointment lifecycle, statuses and transition rules are unchanged. Rejection, cancellation and completion also cancel any queued reminder for that appointment in the same transaction.

## Data minimization

The payload holds only display name, reference (`TC-000123`), service name, dentist display name, formatted start time, and for rejections the clinic's reason (up to 300 characters). Chief complaint, diagnosis, notes and treatment data are never read into the payload. Cancellation reasons are free text written by patients, so they are not emailed. Templates render only known fields, so stray payload keys are ignored.

Tokens: the database stores only the SHA-256 hash in `auth_tokens`. The raw token exists only sealed inside `payload_json.secure` until it is sent, and the worker removes it after a successful send. Abandoning a job also removes it.

## Request flow (booking)

1. `BEGIN`; lock the dentist row; revalidate availability and overlaps (unchanged Phase 9/10 logic).
2. Insert the appointment and its status history.
3. Insert the `email_outbox` row on the same connection.
4. `COMMIT`. The API returns 201 with the appointment. The response does not claim the email was sent.
5. The worker claims the job, renders it, sends it, and marks it `SENT`. A failure is retried or marked failed as described in `worker-and-retry-policy.md`.

Related: `email-outbox-database-design.md`, `worker-and-retry-policy.md`, `appointment-reminder-scheduling.md`.
