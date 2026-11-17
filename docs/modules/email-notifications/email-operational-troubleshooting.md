# Email Operations and Troubleshooting

## Services

| Service | Command | Notes |
|---|---|---|
| `email-worker` | `php bin/email-worker.php` | Health check: `--status`. Logs: `docker logs toothcare-email-worker` and `backend/storage/logs/email-worker.log` |
| `reminder-scheduler` | loop around `php bin/schedule-reminders.php` | One instance only. Logs: `docker logs toothcare-reminder-scheduler` and `backend/storage/logs/reminder-scheduler.log` |
| `mailpit` (dev, profile `mail`) | | UI http://127.0.0.1:8025 |

Both services reuse the `toothcare-php-fpm` image and code, join only the internal `app` network, and expose no ports.

## Everyday commands

```
docker compose up -d email-worker reminder-scheduler          # start
docker compose stop email-worker                              # stop (graceful)
docker compose restart email-worker                           # restart
docker exec toothcare-email-worker php bin/email-worker.php --once     # one batch now
docker exec toothcare-email-worker php bin/email-worker.php --status   # queue + config
docker exec toothcare-reminder-scheduler php bin/schedule-reminders.php # schedule reminders now
docker logs -f toothcare-email-worker                         # follow logs
```

## Admin panel

System Health shows an **Email Delivery** panel: totals, pending, retrying, sent, failed, exhausted, last successful delivery, average delivery delay, SMTP state, and the recent failures with masked recipients, sanitized errors and Retry/Requeue/Abandon actions.

Permissions (migration 030, granted only to `admin`): `email_outbox.view` (stats), `email_outbox.view_failures` (job list and detail), `email_outbox.retry` (retry), `email_outbox.manage` (requeue exhausted, abandon). These routes have no role fallback: an administrator without the permission gets 403. Receptionists, dentists and patients have none by default. Audit actions: `EMAIL_OUTBOX_JOB_VIEWED`, `EMAIL_OUTBOX_JOB_RETRIED`, `EMAIL_OUTBOX_JOB_REQUEUED_EXHAUSTED`, `EMAIL_OUTBOX_JOB_ABANDONED`.

API: `GET /api/v1/admin/email-outbox/stats`, `GET /api/v1/admin/email-outbox/jobs?status=&event_type=&failures_only=&page=&per_page=`, `GET /api/v1/admin/email-outbox/jobs/{id}`, `POST …/jobs/{id}/retry` (body `{"confirm": true}` for exhausted jobs), `POST …/jobs/{id}/abandon`. Payload JSON cannot be edited through the API.

## Metrics and alerts

`GET /api/v1/metrics` (scraped by the `toothcare-api` Prometheus job through nginx): `toothcare_email_jobs_total{event_type}`, `toothcare_email_delivery_success_total{event_type}`, `toothcare_email_delivery_failure_total{event_type,category}`, `toothcare_email_retry_total{event_type}`, `toothcare_email_jobs_pending`, `toothcare_email_jobs_exhausted`, `toothcare_email_worker_processing`, `toothcare_email_last_success_timestamp_seconds`. Labels are bounded enums only.

Alerts in `monitoring/prometheus/rules/toothcare-alerts.yml`: `EmailJobsExhausted`, `EmailBacklogGrowing`, `EmailDeliveryStalled`. Grafana "ToothCare Hub - Overview" has queue and delivery panels.

## Playbooks

**Nothing is being delivered.** Run `--status`. If `mail.valid` is false, fix the listed variables. If it is valid, check `docker logs toothcare-email-worker` for `SMTP_CONNECTION_FAILED`/`SMTP_AUTH_FAILED`. Jobs keep retrying with backoff, and an outage of up to about 7.5 hours (the sum of the default delays) is absorbed automatically.

**Jobs stuck in `PROCESSING`.** They are recovered automatically after `EMAIL_WORKER_LOCK_TIMEOUT` (300 s) by the next batch of any worker.

**Exhausted jobs after an outage.** Once SMTP works again, requeue them from the admin panel (needs `email_outbox.manage` and confirmation).

**`INVALID_RECIPIENT`.** Correct the user's email address, then retry. The retry revalidates the address against the stored row, so update the outbox row only through a supported admin process.

**`PAYLOAD_UNREADABLE`.** `EMAIL_PAYLOAD_KEY` changed. The user should request a new verification or reset link, and the job can be abandoned.

**Verification or reset emails not arriving in development.** Start Mailpit (`docker compose --profile mail up -d mailpit`) and confirm `MAIL_HOST=mailpit`, `MAIL_ENCRYPTION=none`.
