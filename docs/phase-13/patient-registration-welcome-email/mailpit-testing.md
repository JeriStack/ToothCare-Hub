# Mailpit Local Testing Guide

Local verification uses the existing `toothcare-mailpit` container (`axllent/mailpit`) and `toothcare-email-worker` container configured in `compose.yaml` and `compose.dev.yaml`. No external emails ever leave your workstation.

## 1. Prerequisites & Configuration

Ensure your local environment points PHPMailer at the Mailpit container (never commit real SMTP credentials):

```env
MAIL_ENABLED=true
MAIL_MAILER=smtp
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_ENCRYPTION=none
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=noreply@toothcarehub.local
MAIL_FROM_NAME="ToothCare Hub"
```

Start the stack with the `mail` profile if Mailpit is not already running:

```bash
docker compose --profile mail up -d
```

If you recently edited PHP templates or backend services, restart `toothcare-php-fpm` (OPcache) and `toothcare-email-worker` (long-running worker process):

```bash
docker restart toothcare-php-fpm toothcare-email-worker
```

## 2. End-to-End Walkthrough

1. **Open Mailpit Web UI**: Navigate to `http://127.0.0.1:8025` (loopback-only).
2. **Register a Patient**: Visit `http://127.0.0.1:8080/register` (or `POST http://127.0.0.1:8080/api/v1/auth/register` with `accept_legal: true`, `terms_version: "1.0"`, `privacy_version: "1.0"`).
3. **Inspect Initial Emails in Mailpit**: Within a few seconds (`EMAIL_WORKER_SLEEP_SECONDS`), confirm two emails appear:
   - `Thank You for Registering with ToothCare Hub!`
   - `Verify Your ToothCare Hub Email Address`
   Verify both **HTML** and **Text** tabs render cleanly and contain no passwords or clinical details.
4. **Verify Email**: Click the verification button/link in Mailpit (or submit the 64-hex token to `POST /api/v1/auth/verify-email`).
5. **Inspect Welcome Email in Mailpit**: Within a few seconds, confirm a third email arrives:
   - `Welcome to ToothCare Hub — We're Glad You're Here!`
6. **Confirm Idempotency**: Re-submitting the same verification token returns HTTP `422` and generates zero additional welcome emails. Logging in also generates zero duplicate emails.

## 3. Inspecting `email_outbox`

```sql
SELECT id, event_type, template_key, event_key, status, attempts, sent_at
FROM email_outbox
WHERE recipient_email = 'your.test@toothcare.test'
ORDER BY id ASC;
```

Expected statuses: all 3 rows `SENT`, with `payload_json` on the `EMAIL_VERIFICATION` row scrubbed of its sealed `"secure"` token after delivery.

See also the main Phase 13 Mailpit reference: [../mailpit-local-development-guide.md](../mailpit-local-development-guide.md).
