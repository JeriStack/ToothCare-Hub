# Worker and Retry Policy

## Commands

```
php bin/email-worker.php              # continuous; stops cleanly on SIGTERM/SIGINT
php bin/email-worker.php --once       # one batch, then exit
php bin/email-worker.php --batches=N  # at most N batches
php bin/email-worker.php --status     # queue counts + safe mail config, JSON
```

Exit codes: `0` ok, `1` unexpected error, `2` invalid worker configuration, `3` mail disabled or misconfigured (jobs stay queued).

The Docker image now includes the `pcntl` extension, so SIGTERM finishes the current job and stops. Measured `docker stop` time is 0.3 s (previously 30 s, followed by a kill).

## Batch flow

1. **Recover expired locks.** Jobs in `PROCESSING` whose `locked_at` is older than `EMAIL_WORKER_LOCK_TIMEOUT` go back to `FAILED_RETRYABLE` (`LOCK_EXPIRED`), or to `FAILED_PERMANENT` (`LOCK_EXPIRED_EXHAUSTED`) if no attempts remain.
2. **Claim** (one short transaction): select eligible ids (`PENDING`/`FAILED_RETRYABLE`, `next_attempt_at <= now`) with `FOR UPDATE SKIP LOCKED` on MySQL. Then, per id, run `UPDATE … SET status='PROCESSING', attempts=attempts+1, locked_by=?, locked_at=? WHERE id=? AND status IN (…)` and keep the id only when one row changed. Commit.
3. **Send** each job outside any transaction: decode the payload, unseal tokens, revalidate reminders, render, send.
4. **Record the outcome** with `WHERE id=? AND status='PROCESSING' AND locked_by=?`. A worker that lost its lock cannot overwrite another worker's result.

Correctness does not depend on `SKIP LOCKED`: the guarded `UPDATE` with a row-count check alone prevents double claims. `SKIP LOCKED` only avoids lock waits. On MySQL 8.0.46 a claim skipped rows locked by another transaction without blocking (0.008 s).

## Attempt semantics

`attempts` counts **claimed delivery attempts**. It is incremented at claim time, before SMTP is contacted. A worker crash after claiming still uses up an attempt, so a message that crashes the worker cannot loop forever. Jobs left untouched because mail is not operational are not claimed, so they use no attempts.

## Classification (`EmailRetryPolicy::classify`)

| Input | Category | Code | Retried |
|---|---|---|---|
| SMTP 4xx | TEMPORARY | `SMTP_4xx` | yes |
| connection refused, DNS, network | TEMPORARY | `SMTP_CONNECTION_FAILED` | yes |
| timeout | TEMPORARY | `SMTP_TIMEOUT` | yes |
| authentication failure | TEMPORARY | `SMTP_AUTH_FAILED` | yes (fixable by an operator) |
| rejected or invalid recipient | PERMANENT | `INVALID_RECIPIENT` | no |
| SMTP 5xx | PERMANENT | `SMTP_5xx` | no |
| invalid mail configuration from the transport | PERMANENT | `MAIL_CONFIG_INVALID` | no |
| missing template, bad payload, unreadable seal, bad header | PERMANENT | `TEMPLATE_*`, `PAYLOAD_*`, `INVALID_HEADER` | no |
| anything else | UNKNOWN | `SMTP_UNKNOWN` / `UNEXPECTED_ERROR` | yes, bounded by max attempts |

Unknown failures are retried because discarding a possibly temporary failure has no operational justification, and `max_attempts` bounds them. Stored messages are fixed, sanitized strings: server banners, host names and exception text are never persisted.

## Backoff

Delay after attempt N = `EMAIL_RETRY_DELAYS[N-1]` (the last value repeats), multiplied by a random factor in `[1 - jitter, 1 + jitter]`.

| Attempt | Default delay |
|---:|---:|
| 1 | 1 min |
| 2 | 5 min |
| 3 | 15 min |
| 4 | 1 h |
| 5 | 6 h |

When `attempts >= max_attempts` after a retryable failure, the job becomes `FAILED_PERMANENT` with `failed_at` set ("exhausted").

## Configuration

| Variable | Default | Allowed |
|---|---|---|
| `EMAIL_WORKER_ENABLED` | `true` | boolean |
| `EMAIL_WORKER_BATCH_SIZE` | 20 | 1 to 200 |
| `EMAIL_WORKER_MAX_ATTEMPTS` | 5 | 1 to 20 (stored per job at enqueue) |
| `EMAIL_WORKER_LOCK_TIMEOUT` | 300 s | 60 to 3600 |
| `EMAIL_WORKER_SLEEP_SECONDS` | 5 | 1 to 300 |
| `EMAIL_RETRY_DELAYS` | `60,300,900,3600,21600` | positive seconds, each up to 604800 |
| `EMAIL_RETRY_JITTER` | 0.1 | 0 to 0.5 |

Out-of-range values are reported, and the worker refuses to start (exit 2).

## Manual retry (admin)

Retry is allowed only for `FAILED_RETRYABLE`/`FAILED_PERMANENT` jobs. It revalidates the recipient, template and payload, and sets `status=PENDING`, `next_attempt_at=now`, `max_attempts = attempts + 3`. History (`attempts`, `last_error_code`, `created_at`) is kept. An exhausted job also needs `email_outbox.manage` and `{"confirm": true}`. The update is conditional on the current status, so a second concurrent retry gets HTTP 409. The business record is never modified.

## Logged events

`Email job created`, `Email job claimed`, `Email delivered`, `Email delivery failed; retry scheduled`, `Email delivery failed permanently`, `Email job exhausted all attempts`, `Email job cancelled before delivery`, `Email worker recovered expired locks`, `Reminder scheduled`. Context fields are job id, event type, attempt, category, error code, next attempt time and worker id. Recipients, tokens and bodies are never logged.
