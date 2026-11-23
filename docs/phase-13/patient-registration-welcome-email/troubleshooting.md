# Troubleshooting Guide

## Emails Stay `PENDING` in `email_outbox`

1. **Check worker health**:
   ```bash
   docker ps --filter name=toothcare-email-worker
   docker logs --tail 50 toothcare-email-worker
   ```
2. **Verify mail is enabled**: Confirm `MAIL_ENABLED=true` and `EMAIL_WORKER_ENABLED=true` in the container environment. When disabled, `EmailOutboxWorker` intentionally leaves jobs `PENDING` until mail is operational.
3. **Run one batch manually for diagnostics**:
   ```bash
   docker exec toothcare-email-worker php /var/www/backend/bin/email-worker.php --once
   ```

## Newly Edited Templates or PHP Changes Are Not Reflected

- `toothcare-php-fpm` runs with OPcache (`validate_timestamps=0`) and `toothcare-email-worker` is a long-running PHP daemon that keeps loaded classes in memory.
- Restart both containers after backend changes:
  ```bash
  docker restart toothcare-php-fpm toothcare-email-worker
  ```

## Jobs Move to `FAILED_RETRYABLE`

- Inspect `last_error_code` and `last_error_message` on `email_outbox` (safe operational summaries without secrets):
  ```sql
  SELECT id, event_type, status, attempts, next_attempt_at, last_error_code, last_error_message
  FROM email_outbox
  WHERE status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
  ORDER BY id DESC LIMIT 20;
  ```
- Common local cause: `toothcare-mailpit` container is stopped (`docker compose --profile mail up -d`), or `MAIL_HOST` is set to `localhost` instead of `mailpit` inside Docker.

## Welcome Email Did Not Trigger After Verification

- Check the user's `role` in `users`: `PATIENT_WELCOME` is intentionally restricted to `PATIENT` accounts.
- Check if `email_verified` was already `1` before verification (the welcome email triggers only once on the `0 -> 1` transition).
- Check `email_outbox` for `event_key = 'patient-welcome:<user_id>'` to confirm whether it was already queued or delivered.

## Verification Link Reports Invalid or Expired

- Requesting a new verification link (`POST /api/v1/auth/resend-verification`) immediately invalidates all prior unused `EMAIL_VERIFY` tokens for that account. Always use the **most recent** verification email in Mailpit or the inbox.
