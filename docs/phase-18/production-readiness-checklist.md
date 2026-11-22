# Phase 18 — Production Readiness Checklist

Status legend: `PASSED` | `FAILED` | `BLOCKED` | `ACCEPTED RISK` | `NOT IMPLEMENTED` | `NOT APPLICABLE` | `NOT VERIFIED`

| Category | Control | Status | Notes / Evidence |
|---|---|---|---|
| **Security** | Password hashing (`bcrypt`), session regeneration, expiration, single-use hashed tokens | **PASSED** | `AuthService.php`, `AuthIntegrationTest` |
| **Security** | Server-side RBAC/DRBAC & resource ownership (IDOR prevention incl. `/users/{id}/avatar`) | **PASSED** | `Phase16SecurityAuthTest`, `Phase18HardeningTest` |
| **Security** | CSRF protection on authenticated browser mutations | **PASSED** | `CsrfMiddleware.php` hardened & tested (`F-01`) |
| **Security** | CORS strict allowlist (no `*` with credentials) | **PASSED** | `CorsMiddleware.php` |
| **Security** | Rate limiting (auth + realtime ticket issuance) | **PASSED** | `AuthService.php`, `RateLimitMiddleware.php`, `Phase18HardeningTest` |
| **Security** | Parameterized SQL & allowlisted dynamic identifiers (incl. backup DB names) | **PASSED** | Audited all repositories + `DatabaseBackupService` (`F-04`) |
| **Security** | XSS prevention (React escaping, zero `dangerouslySetInnerHTML`) | **PASSED** | Static scan + component tests |
| **Security** | Avatar upload validation (2 MB, `finfo`, `getimagesize`, non-webroot, `nosniff`) | **PASSED** | `AvatarStorageService.php` |
| **Security** | Log redaction (credentials, tokens, session IDs, clinical SPI fields) | **PASSED** | `Logger.php` hardened & tested (`F-03`) |
| **Security** | Public edge blocks `/api/v1/internal/*`, `/api/v1/metrics`, and `/api/v1/docs` in prod | **PASSED** | `toothcare.conf`, `OpenApiDocsController.php` |
| **Transport** | Production HTTPS TLS certs (`443`), HTTP->HTTPS redirect, HSTS, MySQL TLS | **BLOCKED (Pre-Prod Infra)** | Requires deployment-specific CA certificates before go-live (`F-08`) |
| **Privacy** | Technical privacy safeguards, data inventory, proposed retention & IR guide | **PASSED (Technical)** | `docs/phase-18/privacy-and-data-protection-review.md` |
| **Privacy** | Institutional DPO appointment, legal Privacy Notice approval, RA 10173 PIA | **BLOCKED (Institutional)** | Required before processing real patient data |
| **Accessibility** | Landmarks, keyboard focus, form labels, Light/Dark theme, responsive contracts | **PASSED (Automated)** | Full live `axe-core` + screen-reader pass: **NOT VERIFIED** |
| **Performance** | Frontend route/role code splitting (`-66.5%` raw / `-59.3%` gzip main bundle) | **PASSED** | `896.00 kB` -> `299.92 kB` (`159.23 kB` -> `64.88 kB` gzip) |
| **Performance** | Live MySQL 8 `EXPLAIN ANALYZE` load test at clinic scale | **NOT VERIFIED** | Run on staging MySQL 8 with synthetic dataset before go-live |
| **Reliability** | SMTP outage & Socket.IO downtime failure isolation | **PASSED (Automated)** | Live container chaos restarts & staging MySQL restore drill: **NOT VERIFIED** |
| **Supply Chain** | Composer, frontend npm, and realtime npm audits (`0 vulnerabilities`) + CI gates | **PASSED** | Live audits + `.github/workflows/ci.yml` |
