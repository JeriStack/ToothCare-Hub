# Security Policy

ToothCare Hub is a dental appointment and clinic management platform that handles sensitive patient records, practitioner schedules, and role-governed administrative operations. Security and patient privacy are first-order engineering priorities.

---

## Supported Versions

Security fixes are maintained on the active development and release branches:

| Version / Branch | Supported |
|---|---|
| `main` (latest) | Yes |
| `develop` / `development` | Yes |
| Older commits / archived branches | No |

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues, pull requests, or discussions.**

Instead, report vulnerabilities privately using one of the following channels:

1. **GitHub Private Vulnerability Reporting** (preferred): Open a private security advisory under the repository's **Security → Advisories → Report a vulnerability** tab.
2. **Direct Maintainer Contact**: If GitHub Private Vulnerability Reporting is unavailable, contact the repository maintainers directly and include `[SECURITY]` in the subject line.

### What to Include

To help us reproduce, triage, and remediate the issue quickly, please provide:

- A clear description of the vulnerability and its potential security or privacy impact.
- Affected component(s) (e.g., PHP API endpoint, DRBAC policy, Socket.IO handshake/room isolation, email outbox, Nginx/Docker config, or React frontend).
- Step-by-step reproduction instructions or a minimal proof of concept.
- Any suggested remediation, if known.

### Response Timeline

- **Acknowledgment:** Within 48 hours of receipt.
- **Initial Triage & Severity Assessment:** Within 5 business days.
- **Fix & Coordinated Disclosure:** Critical and High vulnerabilities are prioritized immediately; we will coordinate disclosure once a fix is verified and released.

---

## Security Architecture & Scope

Key security controls enforced across ToothCare Hub:

- **Authentication & Sessions:** Native PHP session cookies (`HttpOnly`, `SameSite=Lax`, `SESSION_COOKIE_SECURE=true` in production), `password_hash` (`bcrypt`), session ID regeneration, idle/sliding expiration, single-use SHA-256 hashed verification/reset tokens, and route/action rate limiting (including `/api/v1/realtime/ticket`).
- **CSRF & CORS Protection:** Synchronizer CSRF tokens on state-changing requests (`CsrfMiddleware` hydrates PHP sessions on browser cookie requests before route middleware so checks cannot be bypassed) and explicit CORS origin allowlists (no wildcard `*`).
- **Authorization (RBAC / DRBAC) & Ownership:** Server-side role and granular permission enforcement (`AuthorizationMiddleware`) plus strict resource ownership checks (IDOR protection) across patients, avatars (`/api/v1/users/{id}/avatar` & `/patients/{id}/avatar` with `private` cache), appointments, treatment records, and notifications.
- **File Uploads (`AvatarStorageService`):** 2 MB cap, `finfo` MIME detection + `getimagesize()` verification, randomized non-webroot filenames, `X-Content-Type-Options: nosniff`, and owner/staff retrieval checks.
- **Database Integrity & Backups:** PDO prepared statements only, strict identifier validation in `DatabaseBackupService`, InnoDB transactional row locking (`SELECT ... FOR UPDATE`), AES-256-GCM encrypted backups with SHA-256 manifests, and least-privilege MySQL exporter account (`toothcare_exporter`).
- **Real-Time Service (`realtime/`):** Short-lived single-use hashed Socket.IO connection tickets (`realtime_tickets`), HMAC-SHA256 signed internal calls with replay protection, server-controlled rooms, default-deny client event blocking, session/role revocation, non-root `read_only` container runtime, and minimal non-clinical payloads.
- **Edge, Observability & Log Redaction:** Public Nginx edge blocks `/api/v1/internal/*`, `/api/v1/metrics`, and `/stub_status` (`403`) and disables Swagger UI (`/api/v1/docs` → `404`) in production; `Logger` redacts passwords, hashes, tokens, session IDs, API/SMTP secrets, and clinical SPI fields (`clinical_notes`, `diagnosis`, `medical_alerts`, `allergies`); Nginx logs `$uri` without query strings; Prometheus metrics enforce bounded non-PII labels.
- **Containers & Supply Chain:** Multi-stage locked Dockerfiles (`nginx:stable-alpine3.24`, `php:8.5.12-fpm-alpine3.24`, `node:24-alpine`) with `apk upgrade --no-cache`, `no-new-privileges`, `cap_drop: [ALL]`, non-root workers, CI Trivy `v0.36.0` (`CRITICAL` gate), Composer/npm audits, CodeQL, and Dependabot targeting `development`.
- **Privacy & Regulatory Notice:** Technical safeguards support data protection under the Philippine Data Privacy Act of 2012 (RA 10173), but do **not** constitute legal compliance certification. Real patient data must not be processed until the responsible clinic appoints a Data Protection Officer (DPO) and completes formal privacy/legal governance review (see [`docs/phase-18/privacy-and-data-protection-review.md`](docs/phase-18/privacy-and-data-protection-review.md)).

---

## Safe Harbor

We welcome good-faith security research. Please:

- Test only against your own local development instance (never against live clinic deployments or other users' accounts).
- Avoid denial-of-service testing, automated bulk scraping, or accessing/exfiltrating real patient data.
- Give maintainers a reasonable window to remediate before public disclosure.

---

## Additional Security Documentation

- [Security Checklist](docs/security/security-checklist.md)
- [Authentication Architecture](docs/security/authentication/authentication-architecture.md)
- [Authorization Matrix](docs/security/authentication/authorization-matrix.md)
- [CSRF Protection](docs/security/authentication/csrf-protection.md)
- [Real-Time Authentication & Security (Phase 14)](docs/phase-14/authentication-and-security.md)
- [Operational Visibility & Error Redaction (Phase 15)](docs/phase-15/operational-views.md)
- [Phase 18 Security Audit & Remediation Record](docs/phase-18/security-audit.md)
- [Privacy & Data Protection Review (RA 10173 Technical Review)](docs/phase-18/privacy-and-data-protection-review.md)
- [Incident Response Guide](docs/phase-18/incident-response.md)
- [Container Image Security Policy (Phase 20)](docs/phase-20/image-security-policy.md)
- [Production TLS & Secret Management (Phase 20)](docs/phase-20/environment-and-secret-management.md)
