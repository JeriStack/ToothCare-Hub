# ToothCare Hub — Runtime and Hosting Compatibility Assessment

**Document ID:** `TCH-P0-RUNTIME-001`  
**Version:** `1.0`  
**Phase:** `Phase 0 — Project Initiation and Scope Freeze`  
**Prepared Date:** `2026-10-27`  
**Status:** `Verified & Approved`

---

## 1. Repository & Local Environment Inspection Summary (Evidence-Based)

Direct inspection of the workspace (`c:\xampp\htdocs\GitHub_Clone_File_Projects\ToothCare-Hub`, Git branch `development`) and host CLI tools on `2026-10-27` established the following facts:

1. **Existing Repository Files Inspected:**
   - **Configured & Populated Files:** `README.md`, `CONTRIBUTING.md`, `LICENSE`, `.gitignore`, `.dockerignore`, `.editorconfig`, `.env.example`, `backend/.env.example`, `frontend/.env.example`, `realtime/.env.example`, `backend/composer.json`, `.github/workflows/ci.yml`, `docker-compose.yml`, `docker-compose.prod.yml`, `docker/php/Dockerfile`, `docker/nginx/conf.d/toothcare.conf`, `docker/prometheus/prometheus.yml`, `docker/grafana/provisioning/*`, `docker/grafana/dashboards/toothcare-overview.json`, `frontend/Dockerfile`, `realtime/Dockerfile`, `docs/directory-structure.md`, and `docs/security-checklist.md`.
   - **Zero-Byte Scaffold Placeholders:** Application source files under `backend/src/**`, `database/migrations/**`, `frontend/src/**` (`.jsx`/`.js`), `realtime/src/**`, and `backend/tests/**` currently exist as `0-byte` placeholder files ready to be implemented phase by phase.
2. **Confirmed Host CLI Runtime Outputs:**
   - **Node.js:** `v24.19.0`
   - **npm:** `12.0.2`
   - **System PHP CLI (`C:\php-8.5.12\php.exe`):** `PHP 8.5.12 (cli) (built: Oct 20 2026) (ZTS Visual C++ 2022 x64)` with `Zend OPcache v8.5.12`
   - **XAMPP PHP CLI (`C:\xampp\php\php.exe`):** `PHP 8.5.9 (cli)`
   - **Composer:** `Composer version 2.10.2` (running on `PHP 8.5.12`)
   - **Local XAMPP Database (`C:\xampp\mysql\bin\mysql.exe`):** `Ver 15.1 Distrib 10.4.32-MariaDB, for Win64 (AMD64)`
   - **Docker CLI:** `Docker version 29.9.2, build a82e528` *(Note: `docker compose` CLI plugin returned `unknown command: docker compose` in the current shell session and `.docker\config.json` had a sandbox permission warning; standalone `docker-compose` or Docker Desktop Compose v2 plugin check is noted for Phase 2).*

---

## 2. Component Version & Compatibility Matrix

| Component | Detected Local / Repo Version | Target Version (Container / Lockfile) | Evidence Source | Local Compatibility (Windows + XAMPP / Docker) | Hosting Compatibility (Linux VPS / Docker Host) | Support & Security Considerations | Decision Status |
|---|---|---|---|---|---|---|---|
| **Node.js** | `v24.19.0` *(Host CLI)*; `Node 20` in `.github/workflows/ci.yml`; `node:20-alpine` in Dockerfiles | **`Node 20 LTS` / `22 LTS`** in Docker & CI (`>=20.x` locally) | `node -v` (`v24.19.0`); `.github/workflows/ci.yml` | Compatible: Vite, Vitest, and Socket.IO v4 run cleanly on Node 20, 22, and 24. | Multi-stage `frontend/Dockerfile` and `realtime/Dockerfile` use Alpine Node images. | Run `realtime` service as non-root `node` user; commit `package-lock.json`. | **Approved** |
| **npm** | `12.0.2` *(Host CLI)* | **`npm 10.x / 12.x`** (lockfileVersion 3) | `npm -v` (`12.0.2`) | Compatible on Windows PowerShell and Linux CI runners. | Use `npm ci` in CI and Docker builds for reproducible dependency installation. | Audit dependencies via `npm audit` in CI. | **Approved** |
| **React, Vite & Language (`DEC-TECH-001`)** | `frontend/package.json` is currently `0 bytes`; existing empty placeholders use `.jsx`/`.js` | **`React 18.3.x` + `Vite 6.x`** (TypeScript `.tsx`/`.ts` approved per `DEC-TECH-001`, interoperable with existing layout) | Master Prompt §2 & `DEC-TECH-001` approval | Compatible with Node 24.19.0 and npm 12.0.2. | Static `dist/` bundle served by Nginx (`docker/nginx/conf.d/toothcare.conf`). | Ensure `tsconfig.json` / `vite.config` supports clean module resolution (`@/*`) and zero secrets in `VITE_*` variables. | **Approved (`DEC-TECH-001`)** |
| **UI & Form Libraries** (`Tailwind CSS`, `shadcn/ui`, `Lucide React`, `React Router`, `Axios`, `React Hook Form`, `Zod`) | *To be installed in `frontend/package.json`* | **Tailwind `^3.4`, React Router `^6.28`, Axios `^1.7`, RHF `^7.53`, Zod `^3.23`, Lucide React** | UI/UX Design Guides & Master Prompt §2 | Fully compatible. | Bundled into static production assets. | Centralize API base URL, `withCredentials: true`, and `X-CSRF-Token` handling in `apiClient`. | **Approved** |
| **PHP** | `PHP 8.5.12` (`C:\php-8.5.12\php.exe`) & `PHP 8.5.9` (`C:\xampp\php\php.exe`) | **`PHP 8.5.12`** (`php:8.5.12-fpm-alpine3.24` in `docker/php/Dockerfile`, `"php": "^8.5"` in `backend/composer.json`) | `php -v`, `docker/php/Dockerfile`, `docs/security-checklist.md` | **Verified:** Host default PHP CLI is `8.5.12`, matching `docker/php/Dockerfile` and `.github/workflows/ci.yml`! | Pinned to `php:8.5.12-fpm-alpine3.24` on internal port `9000`. | Fixes **PHP2Shell** (`CVE-2026-109618`, `CVE-2026-109619`) and mitigates `CVE-2026-115560` via `session.upload_progress.enabled = Off` and `expose_php = Off`. | **Approved & Verified** |
| **Composer** | `2.10.2` *(Host CLI)* | **`Composer 2.x`** (`composer:2` in Dockerfile) | `composer --version` (`2.10.2`) | Verified working with `PHP 8.5.12`. | Installs locked dependencies (`--no-dev --optimize-autoloader`) in container builds. | Commit `backend/composer.lock`; never expose `vendor/` publicly. | **Approved & Verified** |
| **Database (`MySQL` / `MariaDB`)** | Local XAMPP: `10.4.32-MariaDB`; `docker-compose.yml`: `mysql:8.0` | **`MySQL 8.0 / 8.4` (`InnoDB`, `utf8mb4`)** in Docker/CI; compatible SQL syntax for local XAMPP MariaDB `10.4` | `mysql.exe --version`; `docker-compose.yml` | **Compatibility Rule:** Write standard ANSI/InnoDB SQL migrations (`INT UNSIGNED AUTO_INCREMENT`, `DATETIME`, `DECIMAL(10,2)`, `ENUM` or `VARCHAR` check, standard FKs) that execute cleanly on **both** MySQL 8.x and XAMPP MariaDB 10.4. | Named volume `mysql-data`; internal network only (`ports: []` in `docker-compose.prod.yml`). | Use `SELECT ... FOR UPDATE` on `dentists` inside InnoDB transactions for race-safe booking. | **Approved & Verified** |
| **Nginx** | Configured in `docker/nginx/conf.d/toothcare.conf` | **`nginx:1.27-alpine`** | `docker-compose.yml` | Maps `8080:80` in `docker-compose.yml` (avoids colliding with XAMPP Apache on port `80`). | Maps `80:80` and `443:443` in `docker-compose.prod.yml`. | Routes `/`, `/api/`, and `/socket.io/`; restrict `/metrics` and `/stub_status`. | **Approved & Verified** |
| **Docker & Compose** | `Docker version 29.9.2, build a82e528` | **Docker Engine `29.x` + Compose v2** (`compose.yaml`, `compose.dev.yaml`, `compose.prod.yaml`, `docker-compose.yml`) | `docker --version`, `docker-compose config -q` | Docker CLI 29.9.2 installed; `docker-compose config -q` verified passing with exit code 0. | Standard Linux Docker Engine + Compose v2 plugin on production VPS. | Keep `.env` files out of build contexts via `.dockerignore`. | **Approved & Verified** |
| **PHPUnit, PHPMailer & swagger-php** | Defined in `backend/composer.json` | **`phpunit/phpunit ^11.3`**, **`phpmailer/phpmailer ^6.9`**, **`zircote/swagger-php ^4.10`**, **`vlucas/phpdotenv ^5.6`** | `backend/composer.json` | Compatible with PHP 8.5.12 (`platform.php = 8.5.0`). | Dev packages excluded in prod image (`--no-dev`). | Validated in `.github/workflows/ci.yml` (`./vendor/bin/phpunit` and `composer run openapi`). | **Approved & Verified** |
| **Vitest & React Testing Library** | Placeholder config in `frontend/vitest.config.js` | **`vitest ^2.x` + `@testing-library/react ^16.x` + `jsdom`** | `frontend/vitest.config.js`, `README.md` | Compatible with Node 24.19.0. | Runs in CI before production build. | Used for `StatusBadge`, forms, landing page, and auth guard tests. | **Approved** |
| **Socket.IO (Server & Client)** | Placeholder files in `realtime/` & `frontend/src/lib/socketClient.js` | **`socket.io ^4.8.x` & `socket.io-client ^4.8.x`** | `docker/nginx/conf.d/toothcare.conf` (`realtime:4000`) | Configured on port `4000` (`realtime/.env.example`). | Internal container port `4000` proxied by Nginx `/socket.io/`. | Authenticate handshake tickets and PHP internal publish requests (`REALTIME_INTERNAL_SECRET`). | **Approved** |
| **Prometheus & Grafana** | Configured in `docker/prometheus/prometheus.yml` & `docker/grafana/` | **`prom/prometheus` + `grafana/grafana`** (Pin explicit tags in Phase 2/19 instead of `:latest`) | `docker-compose.yml` | Local ports `9090` (Prometheus) and `3000` (Grafana). | Restrict admin UIs to localhost/VPN in production; change default credentials. | Exclude all patient PII from metric labels. | **Approved** |

