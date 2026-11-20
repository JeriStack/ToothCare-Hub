# Mailpit Local Email Testing Environment & Inspection Guide

## Overview

**Mailpit** is the dedicated, isolated local SMTP testing sink and web-based email inspection service for ToothCare Hub. It runs alongside the application in Docker Compose, capturing all outgoing transactional and notification emails generated during local development, automated integration testing, and clinical workflow demonstrations.

Mailpit acts as a black hole SMTP server:
- Messages sent by PHPMailer or the background email worker are accepted and held in an in-memory test database.
- **No external network calls are made**: no emails ever leave the developer machine or contact real patients, dentists, or third parties.
- A built-in web interface and REST API enable instant inspection of headers, recipient addresses, subject lines, rendered HTML templates, plain-text alternatives, attachments, and raw MIME sources.

```
+-----------------------------------------------------------------------------------+
|                            ToothCare Hub Local Testing                            |
|                                                                                   |
|  +------------------+         +--------------------+         +-----------------+  |
|  |  MySQL Database  | ------> |  PHP Email Worker  | ------> |   Mailpit SMTP  |  |
|  |   email_outbox   |         |    (PHPMailer)     |         |  localhost:1025 |  |
|  +------------------+         +--------------------+         +--------+--------+  |
|                                                                       |           |
|                                                                       v           |
|                                                              +-----------------+  |
|                                                              |  Mailpit Web UI |  |
|                                                              |  localhost:8025 |  |
|                                                              +-----------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 1. Docker Compose Integration

Mailpit is defined as the `mailpit` service in `compose.yaml` and integrated into the local development profile (`compose.dev.yaml`).

### Docker Configuration (`compose.yaml`)

```yaml
  # ---------------------------------------------------------------------------
  # 5c. Local SMTP sink (development only, opt-in / dev profile default)
  #     Captures all mail; nothing leaves the machine. Web UI: http://127.0.0.1:8025
  #     Point MAIL_HOST=mailpit, MAIL_PORT=1025, MAIL_ENCRYPTION=none at it.
  # ---------------------------------------------------------------------------
  mailpit:
    image: axllent/mailpit:v1.22
    container_name: toothcare-mailpit
    profiles:
      - mail
      - dev
      - local
    ports:
      - "127.0.0.1:${MAILPIT_SMTP_PORT:-1025}:1025"
      - "127.0.0.1:${MAILPIT_WEB_PORT:-8025}:8025"
    networks:
      - app
    healthcheck:
      test: ["CMD-SHELL", "/mailpit readyz || exit 1"]
      interval: 10s
      timeout: 3s
      start_period: 5s
      retries: 3
    restart: unless-stopped
```

### Development Override (`compose.dev.yaml`)

```yaml
  email-worker:
    volumes:
      - ./backend:/var/www/backend

  mailpit:
    ports:
      - "127.0.0.1:${MAILPIT_SMTP_PORT:-1025}:1025"
      - "127.0.0.1:${MAILPIT_WEB_PORT:-8025}:8025"
```

### Architectural Safeguards

1. **Explicit Pinned Image Tag**: Pinned to official release `axllent/mailpit:v1.22`.
2. **Internal Network Reuse**: Mailpit joins the existing isolated `app` bridge network (`toothcare_app`). Container communication uses internal DNS (`mailpit:1025`).
3. **No Public Egress or Exposure**: Host port bindings are strictly bound to loopback `127.0.0.1` (`127.0.0.1:1025` and `127.0.0.1:8025`). Neither SMTP nor HTTP is exposed on `0.0.0.0` or external network interfaces.
4. **Health Check Probing**: Integrates Mailpit's official `/mailpit readyz` probe (`interval: 10s`, `timeout: 3s`, `start_period: 5s`, `retries: 3`).
5. **No Production Exposure**: Production Compose configuration (`compose.prod.yaml`) completely omits the `mail` profile and never runs Mailpit.

---

## 2. SMTP Host, Port & Web UI Addresses

| Context | Protocol | Host / Address | Port | Description |
|---|---|---|---|---|
| **Inside Docker Network** (PHP-FPM, Worker) | SMTP | `mailpit` | `1025` | Internal container hostname on `toothcare_app` |
| **Inside Docker Network** (PHP-FPM, Worker) | HTTP API | `http://mailpit:8025/api/v1` | `8025` | Mailpit REST API for automated inspection |
| **Local Host** (Developer Browser) | HTTP | `http://localhost:8025` or `http://127.0.0.1:8025` | `8025` | Mailpit Web UI |
| **Local Host CLI / Scripts** | SMTP | `localhost` or `127.0.0.1` | `1025` | Host-mapped SMTP sink |

---

## 3. Environment Variables Configuration

### Local Development Environment (`backend/.env` & `.env`)

```env
# Docker Compose Profile
COMPOSE_PROFILES=mail

# Host Port Mappings
MAILPIT_SMTP_PORT=1025
MAILPIT_WEB_PORT=8025

# Transactional SMTP (Targeting Local Mailpit Sink)
MAIL_ENABLED=true
MAIL_MAILER=smtp
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=none
MAIL_FROM_ADDRESS=no-reply@toothcarehub.local
MAIL_FROM_NAME="ToothCare Hub"
MAIL_REPLY_TO_ADDRESS=
MAIL_TIMEOUT=10
MAIL_VERIFY_PEER=true

# Outbox Worker & Scheduling Configuration
EMAIL_WORKER_ENABLED=true
EMAIL_WORKER_BATCH_SIZE=20
EMAIL_WORKER_MAX_ATTEMPTS=5
EMAIL_WORKER_LOCK_TIMEOUT=300
EMAIL_WORKER_SLEEP_SECONDS=5
EMAIL_RETRY_DELAYS=60,300,900,3600,21600
EMAIL_RETRY_JITTER=0.1
EMAIL_REMINDER_LEAD_HOURS=24
```

### Variable Reference

| Variable | Dev Value (Mailpit) | Prod Value | Purpose |
|---|---|---|---|
| `MAIL_ENABLED` | `true` | `true` | Enables or disables outbox processing |
| `MAIL_HOST` | `mailpit` | `smtp.provider.com` | SMTP relay server hostname |
| `MAIL_PORT` | `1025` | `587` or `465` | SMTP port |
| `MAIL_USERNAME` | *(empty)* | `apikey` | SMTP AUTH username (auth disabled when empty) |
| `MAIL_PASSWORD` | *(empty)* | `secret` | SMTP AUTH password |
| `MAIL_ENCRYPTION` | `none` | `tls` or `ssl` | Connection security protocol |
| `MAIL_FROM_ADDRESS` | `no-reply@toothcarehub.local` | `noreply@clinic.com` | Verified envelope sender address |
| `MAIL_FROM_NAME` | `"ToothCare Hub"` | `"ToothCare Hub"` | Friendly sender name |
| `MAIL_TIMEOUT` | `10` | `15` | Socket connection timeout in seconds |
| `MAIL_VERIFY_PEER` | `true` | `true` | Enforces TLS certificate validation |

---

## 4. How to Start Mailpit and the Services

### Start Stack with Mailpit

Using the local compose profile:

```bash
docker compose up -d
```

Because `COMPOSE_PROFILES=mail` is configured in `.env`, `toothcare-mailpit` starts automatically.

Alternatively, to explicitly target the mail profile:

```bash
docker compose --profile mail up -d mailpit email-worker
```

### Verify Service Status

```bash
docker compose ps mailpit email-worker
```

Expected status:
```text
NAME                     IMAGE                   STATUS                   PORTS
toothcare-mailpit        axllent/mailpit:v1.22   Up (healthy)             127.0.0.1:1025->1025/tcp, 127.0.0.1:8025->8025/tcp
toothcare-email-worker   toothcare-php-fpm       Up (healthy)             9000/tcp
```

### Check Mailpit Health Endpoint

```bash
curl -s http://127.0.0.1:8025/api/v1/info
```

Returns JSON runtime telemetry:
```json
{
  "Version": "v1.22.3",
  "Database": "/tmp/mailpit-*.db",
  "Messages": 12,
  "RuntimeStats": {
    "SMTPAccepted": 12,
    "SMTPRejected": 0
  }
}
```

---

## 5. How to Start and Manage the Email Worker

The background worker daemon runs continuously in the `toothcare-email-worker` container:

```bash
# View active worker logs
docker compose logs -f email-worker

# Inspect queue stats and SMTP connectivity
docker exec toothcare-email-worker php bin/email-worker.php --status

# Process one single batch manually on host or inside container
docker exec toothcare-email-worker php bin/email-worker.php --once
```

Worker status output example:
```json
{
    "queue": {
        "counts": {
            "PENDING": 0,
            "PROCESSING": 0,
            "SENT": 12,
            "FAILED_RETRYABLE": 0,
            "FAILED_PERMANENT": 0,
            "CANCELLED": 0
        },
        "exhausted": 0,
        "last_sent_at": "2026-11-17 15:37:12",
        "total": 12
    },
    "mail": {
        "enabled": true,
        "host": "mailpit",
        "port": 1025,
        "encryption": "none",
        "from_address": "no-reply@toothcarehub.local",
        "timeout": 10,
        "verify_peer": true,
        "authenticated": false,
        "is_local_sink": true,
        "valid": true
    }
}
```

---

## 6. Seeded Accounts & Testing Matrix

All test accounts use preserved credentials from database seeds (`database/seeds/002_canonical_demo_accounts.sql` and `database/seeds/development_seed.sql`). Default password for all seeded accounts is `Password123!`.

| Role | Name | Seeded Email | User ID | Profile ID | Primary Workflows |
|---|---|---|---|---|---|
| **Administrator** | Marco Villanueva | `admin@toothcare.com` | `10` | N/A | System admin, password reset, review appointments, outbox oversight |
| **Receptionist** | Clarisse Mendoza | `receptionist@toothcare.com` | `11` | N/A | Front desk queue, approve/confirm/reject appointments, password reset |
| **Dentist** | Dr. Maria Santos | `dentist@toothcare.com` | `12` | Dentist `4` | View schedule, complete clinical visits, password reset |
| **Patient** | Juan Dela Cruz | `patient@toothcare.com` | `13` | Patient `5` | Book visits, receive confirmations, cancel visits, password reset |
| **Dev Patient** | Synthetic Patient | `dev.test.patient@toothcare.local` | Dynamic | Dynamic | Registration email verification, verification resend |

---

## 7. Automated Verification Script

A complete automated verification script is available at `backend/scripts/verify-mailpit.php`:

```bash
docker exec toothcare-php-fpm php scripts/verify-mailpit.php
```

This script:
1. Validates SMTP and Web API connectivity.
2. Clears the Mailpit inbox.
3. Triggers all 11 required email scenarios across all seeded roles.
4. Executes the outbox worker to deliver jobs to Mailpit.
5. Queries the Mailpit REST API to inspect recipients, subjects, HTML rendering, text alternatives, and verify clinical/credential data redaction.

---

## 8. Triggering Test Emails Manually

### Scenario A: Patient Email Verification & Resend

```bash
# 1. Register a test patient via API
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev.manual.test@toothcare.local",
    "password": "Password123!",
    "first_name": "Test",
    "last_name": "Patient",
    "phone": "+639171234567",
    "date_of_birth": "1995-01-01",
    "gender": "MALE",
    "address": "Makati City"
  }'

# 2. Resend verification email
curl -X POST http://localhost:8080/api/v1/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "dev.manual.test@toothcare.local"}'
```

### Scenario B: Password Reset (Patient, Dentist, Staff, Admin)

```bash
curl -X POST http://localhost:8080/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "patient@toothcare.com"}'
```

### Scenario C: Appointment Lifecycle Notifications

```bash
# 1. Log in as patient
curl -c cookies.txt -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "patient@toothcare.com", "password": "Password123!"}'

# 2. Book appointment (Triggers APPOINTMENT_REQUESTED)
curl -b cookies.txt -X POST http://localhost:8080/api/v1/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "dentist_id": 4,
    "service_id": 1,
    "start_at": "2026-11-20 10:00:00",
    "chief_complaint": "Routine checkup"
  }'
```

---

## 9. How to Inspect Captured Emails

### 1. Mailpit Web Interface
Open `http://localhost:8025` in your browser.
- **Message List**: View all messages chronologically with sender, recipient, subject, and time.
- **Message Detail**:
  - **HTML Tab**: Preview the fully styled HTML email as a patient would see it.
  - **Text Tab**: Inspect the plain-text alternative.
  - **Raw Tab**: Inspect raw MIME headers (Subject, To, From, Message-ID).
  - **Headers**: Verify that `no-reply@toothcarehub.local` is set and recipient matches the database account.

### 2. Mailpit REST API

```bash
# List all messages
curl -s http://127.0.0.1:8025/api/v1/messages | jq '.messages[] | {ID, Subject, To: .To[0].Address}'

# Fetch specific message content
curl -s http://127.0.0.1:8025/api/v1/message/<MESSAGE_ID> | jq '{Subject, HTML: .HTML[:200], Text: .Text[:200]}'
```

---

## 10. How to Clear Captured Messages

### Via Web Interface
Click the **"Delete all"** trash icon button in the top navigation bar at `http://localhost:8025`.

### Via REST API / CLI
```bash
curl -X DELETE http://127.0.0.1:8025/api/v1/messages
```

---

## 11. Troubleshooting Connection Failures

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| `Connection refused (mailpit:1025)` | Mailpit container not running | Run `docker compose --profile mail up -d mailpit` |
| `Connection refused (127.0.0.1:8025)` | Port mapping not active or container paused | Check `docker ps`; unpause or recreate: `docker compose up -d mailpit` |
| Worker exits with code `3` | `MAIL_ENABLED=false` or `MAIL_HOST` missing in `.env` | Check `backend/.env` for `MAIL_HOST=mailpit` and `MAIL_PORT=1025` |
| `MAIL_VERIFY_PEER=false is not permitted in production` | Production environment guard triggered | Ensure `APP_ENV=development` in local `.env` |
| Outbox jobs stuck in `PENDING` | Background worker container stopped | Restart worker: `docker compose restart email-worker` |

---

## 12. Differences Between Mailpit Acceptance and Real SMTP Delivery

> [!IMPORTANT]
> **Mailpit Acceptance != Real External Delivery**
>
> When PHPMailer delivers a message to Mailpit:
> 1. Mailpit acts as a local SMTP sink and replies `250 2.0.0 Ok: queued`.
> 2. The outbox worker records `status = 'SENT'` based on this SMTP acceptance.
> 3. **Mailpit does not relay messages to remote MX servers**:
>    - Mailbox existence is not verified at destination domains (`@example.com`, `@gmail.com`).
>    - SPF, DKIM, DMARC alignment is not evaluated by an external receiving MTA.
>    - Greylisting, spam filtering, and provider-side rate limits do not occur.
>
> Local testing verifies outbox transactions, rendering logic, templating, and sender/recipient correctness. Production staging with a verified test domain is required for external deliverability verification.

---

## 13. Production Safety Requirements

1. **Production Guard in Code**: `MailConfig.php` explicitly prohibits `MAIL_HOST=mailpit`, `127.0.0.1`, or `localhost` when `APP_ENV=production`. Attempting to start the application with a local sink in production throws a configuration validation error.
2. **TLS Verification Enforced**: `MAIL_VERIFY_PEER=false` is rejected in production.
3. **No Mailpit in Production Compose**: `compose.prod.yaml` does not declare or include Mailpit.
4. **Secret Store Integration**: In production, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `EMAIL_PAYLOAD_KEY` must be injected via secure environment variables or vault secrets, never committed to `.env`.
5. **Isolated Test Suites**: Automated PHPUnit test suites inject `FakeMailTransport` or run with `MAIL_ENABLED=false`, guaranteeing zero outbound network traffic during test execution.
