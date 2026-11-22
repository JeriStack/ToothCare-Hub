# Dependency and Supply-Chain Security Audit

**Audit Date:** 2026-11-22  
**Execution Mode:** Executed live against Packagist and npm advisory registries.

---

## 1. Executed Audit Results

| Ecosystem | Manifest / Lockfile | Command Executed | Result |
|---|---|---|---|
| **Backend (PHP / Composer)** | `backend/composer.json`, `backend/composer.lock` | `composer --working-dir=backend audit --no-interaction` | **0 vulnerabilities** (`No security vulnerability advisories found.`) |
| **Frontend (React / Vite)** | `frontend/package.json`, `frontend/package-lock.json` | `npm --prefix frontend audit` | **0 vulnerabilities** (`found 0 vulnerabilities`) |
| **Realtime (Node.js / Socket.IO)** | `realtime/package.json`, `realtime/package-lock.json` | `npm --prefix realtime audit` | **0 vulnerabilities** (`found 0 vulnerabilities`) |

---

## 2. Container Base Images Reviewed

| Service | Base Image | Security Posture |
|---|---|---|
| `php-fpm` / workers | `php:8.5.12-fpm-alpine3.24` | Pinned security release; `expose_php = Off`, `session.upload_progress.enabled = Off` |
| `realtime` | `node:24-alpine` (multi-stage) | Runs as non-root `USER node`; production stage omits `devDependencies` |
| `nginx` | `nginx:1.27-alpine` | Minimal Alpine image; static assets & configs mounted `:ro` |
| `mysql` | `mysql:8.0` | Official image; persistent volume `toothcare_mysql_data` |
| `phpmyadmin` | `phpmyadmin:latest` | **Hardened in Phase 18:** Moved to `profiles: ["tools"]` so it is never started by default in production |

---

## 3. Continuous Supply-Chain Automation

- Added `composer audit --no-interaction` to the `backend` job and `npm audit --audit-level=high` to both `frontend` and `realtime` jobs in `.github/workflows/ci.yml`.
- Dependabot and CodeQL workflows remain active for ongoing advisory monitoring.
- **Note:** A clean dependency audit is necessary but not sufficient proof of application security; it complements SAST, regression testing, and manual security review.
