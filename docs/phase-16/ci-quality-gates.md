# Phase 16 — CI/CD Quality Gates

Defined in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) and [`.github/workflows/playwright.yml`](../../.github/workflows/playwright.yml) with minimal `permissions: contents: read`:

| CI Job | Checks Enforced |
| --- | --- |
| **Infrastructure** | `docker compose` validation for `compose.dev.yaml` and `compose.prod.yaml` |
| **Backend (PHP 8.5)** | `composer validate --strict`, `php -l` syntax lint across all PHP files, `composer test:unit`, `composer test:integration`, worker/config/template checks, and `php scripts/validate-openapi.php` |
| **Database Migrations (MySQL 8.0)** | Clean empty-schema apply (`001`–`032`), email/realtime/Phase-15 index verification, and second-run idempotency check |
| **Realtime (Node 24 + Socket.IO)** | `npm ci`, `npm run typecheck`, `npm run build`, `npm test` |
| **Frontend (Node 24)** | `npm ci`, `npm test -- --run`, `npm run build`, `ResponsiveContracts.test.jsx` |
| **Playwright E2E** | Headless Chromium execution (`npm run test:e2e:local`) + failure report artifact upload |
