# Patient Registration Email Workflow

## Lifecycle Stages

Email verification is **mandatory** for newly registered patient accounts (`email_verified = 0` on creation; login is rejected with HTTP 403 until verified). The onboarding email sequence reflects actual account state at every stage.

```mermaid
sequenceDiagram
    participant P as Patient (Browser)
    participant API as AuthService (PHP-FPM)
    participant DB as MySQL (users, auth_tokens, email_outbox)
    participant W as EmailOutboxWorker
    participant SMTP as SMTP / Mailpit

    P->>API: POST /api/v1/auth/register
    API->>DB: BEGIN TX
    API->>DB: Insert user, patient profile, legal acceptances, auth_token (SHA-256 hash)
    API->>DB: Insert email_outbox (PATIENT_REGISTRATION_RECEIVED, key=patient-registration:{uid})
    API->>DB: Insert email_outbox (EMAIL_VERIFICATION, key=user:{uid}:email_verify:{tid})
    API->>DB: COMMIT TX
    API-->>P: 201 Created (account created; emails queued)

    W->>DB: Claim pending outbox jobs (short TX)
    W->>SMTP: Deliver Registration Acknowledgment + Email Verification
    W->>DB: Mark SENT & scrub sealed verification token

    P->>API: POST /api/v1/auth/verify-email {token}
    API->>DB: BEGIN TX
    API->>DB: Validate token, mark email_verified=1, invalidate remaining EMAIL_VERIFY tokens
    API->>DB: If role=PATIENT and transitioned 0->1: Insert email_outbox (PATIENT_WELCOME, key=patient-welcome:{uid})
    API->>DB: COMMIT TX
    API-->>P: 200 OK (verified: true)

    W->>DB: Claim PATIENT_WELCOME job
    W->>SMTP: Deliver Patient Welcome email
    W->>DB: Mark SENT
```

## Event Rules & Guards

| Stage | Event Type | Trigger Location | Strict Guards |
|---|---|---|---|
| 1. Registration Received | `PATIENT_REGISTRATION_RECEIVED` | `AuthService::register()` | Committed registration transaction only; never queued on validation (422) or duplicate email (409) errors; idempotent via `patient-registration:{user_id}`. |
| 2. Email Verification | `EMAIL_VERIFICATION` | `AuthService::register()` & `AuthService::resendVerification()` | Token stored as SHA-256 hash in `auth_tokens`; raw token encrypted in `email_outbox.payload_json` via `PayloadCipher` and scrubbed once sent; resend invalidates prior unused `EMAIL_VERIFY` tokens. |
| 3. Patient Welcome | `PATIENT_WELCOME` | `AuthService::verifyEmail()` | Triggered **only** when `$wasAlreadyVerified === false` AND `$user['role'] === 'PATIENT'`; idempotent via `patient-welcome:{user_id}`; never triggered on login, refresh, resend, or non-patient role verification. |

## Frontend UX Copy Alignment

- **`RegisterForm.jsx`**: Confirms that the account was created and that both the registration confirmation and verification emails have been **queued** (never claims SMTP delivery or inbox arrival has already succeeded). Never surfaces raw SMTP errors to patients.
- **`VerifyEmailPage.jsx`**: Confirms email verification succeeded, notes that a welcome email has been queued, and provides an anti-enumeration resend flow for expired or invalid verification links.
