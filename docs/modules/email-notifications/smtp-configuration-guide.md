# SMTP Configuration Guide

All values come from environment variables (`backend/.env` locally, the deployment's secret store in production). The frontend never sees them. The API exposes only `enabled`, `operational` and validation messages. Logs and the worker's `--status` output use `MailConfig::describe()`, which omits the username and password.

## Variables

| Variable | Default | Notes |
|---|---|---|
| `MAIL_ENABLED` | `true` | `false` keeps jobs queued; nothing is sent |
| `MAIL_HOST` | (required) | `mailpit` for local development |
| `MAIL_PORT` | `587` | 1 to 65535 |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | empty | SMTP AUTH is used when a username is set |
| `MAIL_ENCRYPTION` | `tls` | `none`, `tls` (STARTTLS, usually 587), `ssl` (implicit TLS, usually 465) |
| `MAIL_FROM_ADDRESS` | (required) | Must be a valid address |
| `MAIL_FROM_NAME` | `ToothCare Hub` | |
| `MAIL_REPLY_TO_ADDRESS` | empty | Optional, validated |
| `MAIL_TIMEOUT` | `15` | 1 to 120 seconds |
| `MAIL_VERIFY_PEER` | `true` | `false` is rejected when `APP_ENV=production` |
| `EMAIL_PAYLOAD_KEY` | dev fallback | **Required in production.** Encrypts tokens held in the outbox. Generate: `php -r "echo bin2hex(random_bytes(32));"` |
| `APP_URL` | | Base for verification and reset links |

Worker and retry variables are in `worker-and-retry-policy.md`.

Validation runs when the worker starts and on each stats request. An invalid configuration never breaks unrelated API requests: jobs stay queued, the worker exits with code 3 in `--once` mode or logs the problem in continuous mode, and the admin panel shows "SMTP misconfigured" with the reasons.

## Development (Mailpit sink)

```bash
docker compose --profile mail up -d mailpit
# Or automatically with default profile:
docker compose up -d
```

In `backend/.env`: `MAIL_HOST=mailpit`, `MAIL_PORT=1025`, `MAIL_ENCRYPTION=none`, `MAIL_FROM_ADDRESS=no-reply@toothcarehub.local`. Captured mail is at http://127.0.0.1:8025 (SMTP at localhost:1025). Nothing leaves the machine. See [Mailpit Local Development Guide](../../phase-13/mailpit-local-development-guide.md) for detailed workflows.

## Production

1. Store `MAIL_USERNAME`, `MAIL_PASSWORD` and `EMAIL_PAYLOAD_KEY` in the secret store and inject them as environment variables into the `php-fpm`, `email-worker` and `reminder-scheduler` containers.
2. Use `MAIL_ENCRYPTION=tls` on port 587 (or `ssl` on 465) and keep `MAIL_VERIFY_PEER=true`.
3. Use a `MAIL_FROM_ADDRESS` on a domain with SPF, DKIM and DMARC configured at your provider.
4. Check the result: `docker exec toothcare-email-worker php bin/email-worker.php --status` should show `"valid": true`.

## Credential rotation

1. Create the new SMTP credential at the provider while the old one still works.
2. Update the secret, then recreate the worker: `docker compose up -d --force-recreate email-worker`.
3. Run `--status` and send a test, for example by resending a verification email from a test account.
4. Revoke the old credential.

Rotating `EMAIL_PAYLOAD_KEY` makes queued but unsent verification and reset emails unreadable. They fail with `PAYLOAD_UNREADABLE` and the user can request a new link. Rotate when the queue is drained.

## Common SMTP failures

| Symptom (`last_error_code`) | Likely cause | Action |
|---|---|---|
| `SMTP_CONNECTION_FAILED` | Wrong host or port, firewall, provider down | Check `MAIL_HOST`/`MAIL_PORT` and network egress. Retried automatically. |
| `SMTP_TIMEOUT` | Slow or blocked network | Raise `MAIL_TIMEOUT` if needed. Retried. |
| `SMTP_AUTH_FAILED` | Wrong or rotated credentials | Fix the secret and recreate the worker. Retried until attempts run out, then requeue from the admin panel. |
| `SMTP_4xx` | Temporary rejection or greylisting | Retried with backoff. |
| `SMTP_5xx`, `INVALID_RECIPIENT` | Permanent rejection | Not retried. Correct the user's address before retrying. |
| `MAIL_NOT_OPERATIONAL` | Disabled or invalid config | See `--status` and the validation messages. |
