# Testing Guide

## 1. Backend Automated Tests (PHPUnit)

Run the dedicated onboarding email test suites (uses an in-memory SQLite test DB and fake `MailTransportInterface`; zero external emails are ever sent):

```bash
php backend/vendor/bin/phpunit --configuration backend/phpunit.xml \
  backend/tests/Unit/EmailTemplateRendererTest.php \
  backend/tests/Integration/PatientRegistrationEmailFlowTest.php \
  backend/tests/Integration/EmailOutboxFlowTest.php \
  backend/tests/Unit/AuthServiceTest.php
```

### Coverage Matrix

- **Template Rendering (`EmailTemplateRendererTest`)**:
  - Subject, heading, HTML/plain-text parity, bullet list rendering, XSS escaping, absolute verification/login URLs, configured `ttl_hours`, and absence of passwords/clinical text for `patient-registration-received`, `verify-email`, and `patient-welcome`.
- **Integration & Security (`PatientRegistrationEmailFlowTest`)**:
  - Registration queues `PATIENT_REGISTRATION_RECEIVED` + `EMAIL_VERIFICATION` and does **not** queue `PATIENT_WELCOME`.
  - Worker processes outbox and delivers to exact recipient; extracting token and calling `verifyEmail()` queues `PATIENT_WELCOME` strictly once.
  - Subsequent logins, profile fetches, and direct duplicate enqueue calls produce zero duplicate outbox rows.
  - `resendVerification()` invalidates previous unused verification tokens and never queues duplicate acknowledgment or welcome emails.
  - Transient SMTP failure (`421` / connection error) does not roll back registration, sets `FAILED_RETRYABLE`, and succeeds on retry after backoff.
  - Permanent SMTP failure (`550` / recipient rejected) marks `FAILED_PERMANENT` without infinite retries.
  - Failed validation (`422`) and duplicate registration (`409`) leave zero orphaned outbox rows.
  - Non-patient (`ADMIN`) email verification does not enqueue `PATIENT_WELCOME`.

## 2. Frontend Automated Tests (Vitest)

```bash
npm --prefix frontend test -- --run src/tests/auth/
npm --prefix frontend run build
```

Verifies `RegisterForm.jsx` displays accurate queued-email confirmation copy after registration, handles resend confirmation safely without leaking SMTP details, and builds cleanly for production.

## 3. Live Mailpit Integration Test

Follow [mailpit-testing.md](mailpit-testing.md) to verify the complete Docker pipeline (`Nginx -> PHP-FPM -> MySQL email_outbox -> toothcare-email-worker -> PHPMailer -> toothcare-mailpit`).
