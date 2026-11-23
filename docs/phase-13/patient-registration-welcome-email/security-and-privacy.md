# Security & Privacy Controls

## 1. Verification Token Protection

- **Database Storage**: Verification tokens in `auth_tokens` are stored exclusively as `SHA-256` hashes (`hash('sha256', $rawToken)`), never plaintext.
- **Outbox Transit Storage**: Raw tokens placed into `email_outbox.payload_json` for delayed rendering are encrypted with `PayloadCipher` (AES-256-GCM authenticated encryption) under the `secure` payload key and immediately scrubbed from `payload_json` once `EmailOutboxWorker` marks the job `SENT`.
- **Single-Use & Expiration**: Tokens expire after the configured `email_verification_token_ttl` (default 24 hours). Verification marks the token consumed and invalidates any remaining unused `EMAIL_VERIFY` tokens for that user. Calling `resendVerification()` invalidates all previous unused `EMAIL_VERIFY` tokens before issuing a replacement.
- **Log Redaction**: Raw verification tokens, passwords, and SMTP credentials are never written to application logs.

## 2. Injection & Content Safety

- **HTML Escaping**: `EmailTemplateRenderer` escapes all dynamic strings (patient names, clinic info, bullets, URLs) using `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
- **Header Injection Guard**: `EmailService::hasHeaderInjection()` rejects `\r`, `\n`, and null bytes in subjects and recipient names as permanent failures.
- **No External Assets**: Email HTML templates omit external images, scripts, and tracking pixels to prevent data leakage and pixel tracking.

## 3. Privacy & Data Minimization

- **Strict Purpose Limitation**: Onboarding emails are strictly transactional (registration acknowledgment, email verification, verified welcome). Marketing or promotional content is never bundled.
- **No Sensitive Clinical or Credential Data**: Templates never include plaintext passwords, medical history disclosures, allergies, or appointment clinical notes.
- **Anti-Enumeration**: `POST /api/v1/auth/resend-verification` always returns a generic response regardless of whether an address exists or is already verified, preventing account discovery.
- **Role Isolation**: `PATIENT_WELCOME` is strictly restricted to accounts with `role = 'PATIENT'`; staff/admin/dentist verification events do not emit patient welcome emails.
