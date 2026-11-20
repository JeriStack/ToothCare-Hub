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

- **Authentication & Sessions:** Native PHP session cookies (`HttpOnly`, `SameSite=Lax`, `Secure` in production), bcrypt/argon2 password hashing, email verification, and password reset tokens stored as hashes.
- **CSRF & CORS Protection:** Synchronizer CSRF tokens on state-changing API requests (`CsrfMiddleware`) and explicit CORS origin allowlists (no wildcard `*`).
- **Authorization (RBAC / DRBAC):** Server-side role and granular permission checks (`AuthorizationMiddleware`) plus strict resource ownership enforcement (IDOR protection) across patients, dentists, receptionists, and administrators.
- **Database Integrity:** PDO prepared statements only, InnoDB transactional row locking (`SELECT ... FOR UPDATE`) for booking concurrency, and encrypted backup support.
- **Real-Time Service (`realtime/`):** Short-lived single-use hashed Socket.IO connection tickets (`realtime_tickets`), HMAC-SHA256 signed service-to-service calls with timestamp/nonce replay protection, server-controlled rooms, default-deny client event blocking, session/role revocation, Nginx edge blocking of `/api/v1/internal/*`, and minimal non-clinical event payloads.
- **Secrets & Privacy:** `.env` files, production credentials, private keys, raw tickets, and real patient data must never be committed to Git or written to logs.

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
