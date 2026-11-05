# Phase 7 — Authentication, Authorization, and Account Security
## ToothCare Hub — Dental Appointment and Clinic Management System

### Executive Summary

Phase 7 establishes secure, robust, server-enforced identity management, role-based access control (RBAC), resource ownership authorization, CSRF mitigation, brute-force rate limiting, and account recovery for ToothCare Hub.

All security checks, credential verifications, and resource ownership boundaries are strictly executed on the PHP backend; the React/TypeScript frontend acts as an interactive client and never constitutes a security boundary.

---

### Core Principles & Architecture

1. **Server-Enforced Authorization Boundary**: Client-supplied role definitions or claimed identifiers are untrusted. Registration strictly assigns the `PATIENT` role on the server.
2. **Session-Based Cookie Authentication**: Server-side PHP sessions using `HttpOnly`, `SameSite=Lax`, and `Secure` (production HTTPS) cookies (`toothcare_session`).
3. **Anti-CSRF Protection**: Cryptographically secure 256-bit entropy tokens validated via `X-CSRF-Token` header on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
4. **IDOR & Resource Ownership Protection**: Patients can only inspect and mutate their own profile and appointments (`user_id === authenticated_user_id`). Dentists are restricted to assigned patients, and Administrators exercise authorized clinic oversight.
5. **Secure Token Storage**: Email verification and password reset tokens are single-use, expiring, and stored exclusively as cryptographic hashes (`SHA-256`) at rest.
6. **Account Enumeration Prevention**: Public endpoints (`/auth/forgot-password`, `/auth/resend-verification`) return identical generic envelopes regardless of account existence.
7. **Rate Limiting & Abuse Prevention**: Sliding-window rate limit buckets for login, registration, and recovery endpoints with standard `429 Too Many Requests` responses and `Retry-After` headers.
8. **Sanitized Audit Logging**: Tamper-evident audit trail in `audit_logs` capturing security actions while stripping credentials, passwords, session IDs, and raw tokens.

---

### Phase 7 Documentation Sitemap

| Document | Purpose |
|---|---|
| [`authentication-architecture.md`](./authentication-architecture.md) | High-level authentication transport, request lifecycle, and token lifecycle |
| [`authorization-matrix.md`](./authorization-matrix.md) | Role-based access control (RBAC) permissions matrix and default-deny policies |
| [`session-management.md`](./session-management.md) | Session lifecycle, cookie security attributes, fixation prevention, and logout |
| [`csrf-protection.md`](./csrf-protection.md) | CSRF token lifecycle, delivery endpoint, Axios auto-injection, and route exemptions |
| [`email-verification.md`](./email-verification.md) | Single-use expiring token generation, SHA-256 hashing, and verified status transition |
| [`password-reset.md`](./password-reset.md) | Password recovery workflow, anti-enumeration guarantees, and session revocation |
| [`rate-limiting.md`](./rate-limiting.md) | Sliding-window thresholds, key generation, database bucket storage, and 429 errors |
| [`security-audit-logging.md`](./security-audit-logging.md) | Audit trail schema, action taxonomy, and recursive payload credential redaction |
| [`security-testing.md`](./security-testing.md) | Automated PHPUnit verification suite covering Security Tests A through H |
| [`environment-configuration.md`](./environment-configuration.md) | Environment variables, password complexity policies, token TTLs, and production hardening |

---

### Implemented REST Endpoints

| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Rate Limited | Patient registration (forces `PATIENT` role) |
| `POST` | `/api/v1/auth/login` | Rate Limited | Credential verification & session establishment |
| `POST` | `/api/v1/auth/logout` | Session + CSRF | Invalidate session & expire session cookie |
| `GET` | `/api/v1/auth/me` | Session Auth | Retrieve authenticated identity & role context |
| `GET` | `/api/v1/auth/csrf-token` | Public | Retrieve or generate active anti-CSRF token |
| `POST` | `/api/v1/auth/verify-email` | Public | Verify email address using single-use hashed token |
| `POST` | `/api/v1/auth/resend-verification` | Rate Limited | Resend verification link (anti-enumeration) |
| `POST` | `/api/v1/auth/forgot-password` | Rate Limited | Request reset link (anti-enumeration) |
| `POST` | `/api/v1/auth/password/forgot` | Rate Limited | Route alias for password reset request |
| `POST` | `/api/v1/auth/reset-password` | Public | Complete password reset & invalidate old sessions |
| `POST` | `/api/v1/auth/password/reset` | Public | Route alias for reset completion |
| `GET` | `/api/v1/patients/{id}` | Session Auth + Ownership | Retrieve patient profile (ownership enforced) |
| `PATCH` | `/api/v1/patients/{id}` | Session Auth + Ownership + CSRF | Update patient profile (ownership enforced) |
| `GET` | `/api/v1/admin/audit-logs` | Session Auth + RBAC (`ADMIN`) | Administrative verification route |

