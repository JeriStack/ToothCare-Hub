# ToothCare Hub

**Brand Tagline:** *Healthier Smiles. Brighter Futures.*

<p align="justify">
A responsive web-based dental appointment and clinic management system. ToothCare Hub replaces manual appointment handling with a structured digital workflow where <strong>MySQL (<code>InnoDB</code>) and the native PHP REST API (<code>/api/v1</code>) serve as the authoritative system of record</strong>, supported by a <strong>React + Vite</strong> frontend, <strong>PHPMailer</strong> asynchronous email outbox processing, <strong>Node.js + Socket.IO</strong> real-time notifications, <strong>Docker Compose + Nginx</strong> containerization, and <strong>Prometheus + Grafana</strong> observability.
</p>

---

## 1. Project Objectives

<div align="justify">

1. **Prevent Conflicting Bookings:** Enforce dentist schedules, time-off blocks, and variable service durations using server-side validation and transaction-safe InnoDB row locking (`SELECT ... FOR UPDATE`).
2. **Enforce Least-Privilege Role Boundaries:** Re-validate authentication, role permissions, and resource ownership on every `/api/v1/*` request.
3. **Isolate Notification Side Effects:** Persist in-app notifications and `email_outbox` rows inside the booking transaction; deliver SMTP emails and Socket.IO broadcasts only after commit so external outages never roll back a saved appointment.
4. **Provide Reproducible Delivery & Observability:** Package services with Docker Compose behind an Nginx reverse proxy, gate changes with GitHub Actions CI, and monitor service health with Prometheus and Grafana.

</div>

---

## 2. Target Users & Roles

<div align="justify">

- **Administrator (`ADMIN`):** Manages user accounts, DRBAC role-permission matrices, clinic operating hours/closures, dental services, dentist rosters, and clinic-wide appointments; reviews real-time executive KPIs, operational reports (appointments, service utilization, dentist workload, patient registrations), append-only audit logs, outbox delivery health, and redacted operational errors.
- **Receptionist / Front Desk (`RECEPTIONIST`):** Manages daily arrival schedules, patient check-ins, live waiting queues, walk-in intake/booking, and appointment triage (`CONFIRMED` / `REJECTED`) with role-scoped front-desk KPIs.
- **Dentist (`DENTIST`):** Views strictly scoped daily and upcoming assigned appointments; accesses permitted patient visit context; records versioned clinical treatment notes with FDI tooth charting; marks eligible visits `COMPLETED`; submits time-off requests.
- **Patient (`PATIENT`):** Registers or signs in with email verification; browses active dental services and dentists; checks real-time slot availability; books appointments via a guided wizard; tracks status lifecycle (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`), receives live Socket.IO + email notifications, and cancels/reschedules within clinic policy rules.

</div>

---

## 3. Technology Stack

| Layer | Technology | Implementation Status |
|---|---|---|
| **Frontend** | React 18, Vite 8 (Rolldown), Tailwind CSS 3, Lucide React, React Router 7, Socket.IO Client | Full SPA with Light/Dark theme system, route/role-level `React.lazy` code splitting (`299.92 kB` / `64.88 kB` gzip main chunk), role portals, appointment search, reports, and live real-time notifications |
| **Backend API** | Native PHP (`^8.5`, `8.5.12-fpm-alpine3.24`), Composer, PDO, `zircote/swagger-php` | 105 OpenAPI 3.0.3-documented `/api/v1/*` paths (138 operations) generated from PHP 8 attributes (`docs/openapi.yaml`), local/dev Swagger UI (`/api/v1/docs`, `/api-docs`, `404` in prod), and API guides (`docs/api/README.md`) |
| **Database** | MySQL 8.0 (`InnoDB`, `utf8mb4`) | 32 ordered SQL migrations (`001`–`032`), transaction-safe row locking, persistent `toothcare_mysql_data` volume, AES-256-GCM encrypted backups, and composite reporting/search indexes |
| **Email Worker** | PHPMailer (`^7.2`) over SMTP + transactional `email_outbox` | Outbox worker (`backend/bin/email-worker.php`) & reminder scheduler (`backend/bin/schedule-reminders.php`) with encrypted payloads, retry policy, and Prometheus backlog/age metrics |
| **Real-Time** | Node.js (`24-alpine`) + TypeScript + Socket.IO (`^4.8.1`) | Authenticated WebSocket service (`realtime/`) with short-lived hashed tickets, HMAC-SHA256 internal publisher/revocation, non-root `read_only` runtime, and `realtime_outbox` worker |
| **Reverse Proxy** | Nginx (`stable-alpine3.24`) | Hardened `docker/nginx/production.conf` & TLS/WSS template (`production-tls.conf.example`), immutable `/assets/` caching, privacy-safe `$uri` access logs, internal-only port `8081` (`/internal/`, `/metrics`, `/stub_status`), and security headers |
| **Containerization** | Docker Compose v2 (`compose.yaml`, `compose.dev.yaml`, `compose.prod.yaml`) | Multi-stage locked Dockerfiles with `apk upgrade --no-cache`, zero host source mounts or public MySQL in prod, non-root workers, `no-new-privileges`, `cap_drop: [ALL]`, health checks, and resource limits |
| **Observability** | Prometheus + Grafana + `mysqld-exporter` + `nginx-exporter` + `cadvisor` (+ Linux `node-exporter`) | Optional Compose profile `monitoring` (`--profile monitoring`), 15 alert rules, provisioned Application & Infrastructure dashboards, least-privilege MySQL exporter, and `15d` retention |
| **Testing & CI/CD** | PHPUnit, Vitest 5, Node `node:test`, Playwright, Trivy `v0.36.0`, `promtool`, GitHub Actions, CodeQL, Dependabot | Automated lint, Composer/npm audits, OpenAPI drift & 100% route-coverage checks, MySQL 8 migration verification, unit/integration suites, responsive contracts, multi-stage Docker builds, `nginx -t`, and Trivy `CRITICAL` scans |

---

## 4. Repository Directory Overview

| Path | Responsibility |
|---|---|
| `frontend/` | React + Vite single-page application (public landing page, auth, role dashboards, booking wizard) |
| `backend/` | Native PHP REST API (`/api/v1` controllers, services, PDO repositories, middleware, validators, jobs) |
| `realtime/` | Node.js + Socket.IO authenticated real-time notification service |
| `database/` | Ordered SQL migrations (`database/migrations/`), synthetic seeds (`database/seeds/`), and schema snapshot |
| `docker/` | Container build files (`php/Dockerfile`, `nginx/`) |
| `nginx/` | Reverse proxy configuration (`nginx.conf`, `conf.d/toothcare.conf`, `snippets/`) |
| `monitoring/` | Prometheus scrape/alerting rules and Grafana datasource/dashboard provisioning |
| `deployment/` | Deployment, rollback, health-check scripts, and Apache VirtualHost fallback example |
| `scripts/` | Windows PowerShell helper scripts for local setup, testing, and OpenAPI generation |
| `docs/` | Project documentation, organized by topic. Start at [`docs/README.md`](docs/README.md) |
| `.github/` | GitHub Actions CI/CD workflows, issue templates, and PR template |

---

## 5. Prerequisites

- **Git:** `2.40+` (Verified locally: `2.56.0.windows.2`)
- **Docker Engine / Docker Desktop + Compose:** Docker `26+` and Docker Compose v2 (Verified locally: Docker `29.9.2`, Compose `v5.6.1`)
- **PHP & Composer (for direct host CLI / IDE checks):** PHP `8.5.x` (`>= 8.5.12` recommended) with extensions `PDO`, `pdo_mysql`, `openssl`, `mbstring`, `json`, `curl`, `fileinfo`, and Composer `2.x`
- **Node.js & npm (for direct host CLI / IDE checks):** Node.js `22 LTS` / `24 LTS` and npm `10+`
- **MySQL 8.x (or non-Docker fallback):** Canonical database runs in Docker (`mysql:8.0`); avoid running host MySQL on port `3306` simultaneously with the Docker `mysql` container.

---

## 6. Environment Configuration Instructions

All `.env.example` files contain safe placeholders only. Copy each template to a local ignored `.env` file before starting services:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
Copy-Item realtime/.env.example realtime/.env
```

- Edit `.env`, `backend/.env`, `frontend/.env`, and `realtime/.env` with local development values.
- **Security Rule:** Never commit real `.env` files, SMTP credentials, private keys, or patient data. Never place secrets in `frontend/.env` (`VITE_*` variables are bundled into browser code).
- See [`docs/setup/environment-configuration.md`](docs/setup/environment-configuration.md) for full variable documentation.

---

## 7. Local Setup & Docker Compose Commands

### 7.1 Validate Compose Configuration
```powershell
# Validate base compose specification
docker compose config

# Validate with development overrides
docker compose -f compose.yaml -f compose.dev.yaml config
```

### 7.2 Start and Stop the Containerized Stack (Phase 2 Standard)
```powershell
# Build images and start all baseline services in background
docker compose -f compose.yaml -f compose.dev.yaml up -d --build

# Inspect running containers and health status
docker compose ps

# View live service logs
docker compose logs -f

# Inspect specific services
docker compose logs -f nginx php-fpm realtime email-worker mysql

# Stop stack (preserves named database volume toothcare_mysql_data)
docker compose down
```

### 7.3 Optional Observability Stack
```powershell
# Start services with Prometheus, Grafana, Nginx/MySQL exporters, and cAdvisor enabled
docker compose --profile monitoring -f compose.yaml -f compose.dev.yaml up -d

# Stop monitoring profile
docker compose --profile monitoring -f compose.yaml -f compose.dev.yaml down
```

### 7.4 Service Management & Verification
```powershell
# Validate Nginx configuration syntax inside container
docker compose exec nginx nginx -t

# Validate hardened production Compose stack (immutable images, zero dev bind mounts)
docker compose -f compose.yaml -f compose.prod.yaml config -q

# Rebuild an individual service without stopping others
docker compose build php-fpm
docker compose up -d --no-deps php-fpm
```

---

## 8. Expected Local URLs and Port Assumptions

| Service | Local URL / Port | Exposure Policy | Expected Response |
|---|---|---|---|
| **App & Landing via Nginx** | `http://localhost:8080/` | Public entry point | Interactive ToothCare Hub SPA & role portals |
| **Nginx Health Check** | `http://localhost:8080/health` | Public entry point | `{"status":"healthy","service":"toothcare-nginx"}` |
| **REST API Health Check** | `http://localhost:8080/api/v1/health` | Routed via Nginx FastCGI | `{"data":{"status":"healthy",...},"meta":{...},"error":null}` |
| **Swagger UI (Local/Dev Only)** | `http://localhost:8080/api/v1/docs` (or `/api-docs`) | Dev/Testing only (`404` in production) | Interactive OpenAPI 3.0.3 documentation |
| **Socket.IO Realtime Service** | `http://localhost:8080/socket.io/` | Proxied via Nginx WebSocket | Authenticated Socket.IO handshake |
| **Prometheus Metrics & Stub Status** | `http://nginx:8081/api/v1/metrics`, `/stub_status` | **Internal Docker network only (`403` publicly)** | Prometheus text format metrics |
| **MySQL Database** | `127.0.0.1:3306` (`compose.dev.yaml` only) | Private internal network (unpublished in prod) | MySQL 8.0 server |
| **Mailpit Web UI** | `http://127.0.0.1:8025` (`--profile mail` dev only) | Loopback only | Local captured SMTP test emails |
| **Prometheus UI** | `http://127.0.0.1:9090` (`--profile monitoring`) | Loopback only (VPN/proxy in prod) | Prometheus targets, PromQL & alerts |
| **Grafana UI** | `http://127.0.0.1:3001` (`--profile monitoring`) | Loopback only (anonymous disabled) | Provisioned Application & Infrastructure dashboards |

---

## 9. Testing & Verification Commands

```powershell
# Backend unit & integration tests (PHPUnit) + Composer security audit
composer --working-dir=backend validate --strict
composer --working-dir=backend audit --no-interaction
composer --working-dir=backend test:unit
composer --working-dir=backend test:integration

# OpenAPI 3.0.3 generation, drift check, and 100% route-coverage validation
composer --working-dir=backend openapi:generate
composer --working-dir=backend openapi:check
composer --working-dir=backend openapi:validate

# Frontend dependency audit, Vitest suite, and Vite production build
npm --prefix frontend audit
npm --prefix frontend test -- --run
npm --prefix frontend run build

# Real-time Socket.IO dependency audit, typecheck, build, and tests
npm --prefix realtime audit
npm --prefix realtime run typecheck
npm --prefix realtime test

# Playwright browser E2E tests (local Chromium on dedicated port 5174)
npm run test:e2e:local
```

---

## 10. Git Branch and Commit Conventions

- **Branches:** `main` (stable/releasable), `development` / `develop` (active integration; Dependabot targets `development`), `feature/<short-description>`, `fix/<short-description>`, `docs/<short-description>`, `chore/<short-description>`.
- **Commits:** Imperative [Conventional Commits](https://www.conventionalcommits.org/) under 72 characters (e.g., `feat(appointments): validate slot conflicts`, `fix(auth): reject expired session`, `security(docker): upgrade Nginx base to stable-alpine3.24`).

---

## 11. Project Documentation Index

- **Master Documentation Index:** [`docs/README.md`](docs/README.md)
- **Planning, Setup & Architecture (Phases 0–2):** [`docs/setup/local-development.md`](docs/setup/local-development.md), [`docs/setup/environment-configuration.md`](docs/setup/environment-configuration.md), [`docs/architecture/directory-structure.md`](docs/architecture/directory-structure.md)
- **Phase 13 — Email Outbox Notifications:** [`docs/modules/email-notifications/email-architecture.md`](docs/modules/email-notifications/email-architecture.md)
- **Phase 14 — Real-Time Notifications (Node.js + Socket.IO):** [`docs/phase-14/`](docs/phase-14/architecture.md)
- **Phase 15 — Dashboards, Search, Reports, & Operational Views:** [`docs/phase-15/`](docs/phase-15/dashboard-metrics.md)
- **Phase 16 — Testing Strategy & Regression Coverage:** [`docs/phase-16/`](docs/phase-16/testing-strategy.md)
- **Phase 17 — API Documentation & OpenAPI 3.0.3:** [`docs/api/README.md`](docs/api/README.md), [`docs/openapi.yaml`](docs/openapi.yaml)
- **Phase 18 — Security, Privacy, Accessibility, & Performance Hardening:** [`docs/phase-18/security-audit.md`](docs/phase-18/security-audit.md), [`docs/phase-18/production-readiness-checklist.md`](docs/phase-18/production-readiness-checklist.md)
- **Phase 19 — Observability with Prometheus & Grafana:** [`docs/phase-19/monitoring-architecture.md`](docs/phase-19/monitoring-architecture.md), [`docs/phase-19/observability-runbook.md`](docs/phase-19/observability-runbook.md)
- **Phase 20 — Production Container Hardening & Nginx Release Config:** [`docs/phase-20/production-container-architecture.md`](docs/phase-20/production-container-architecture.md), [`docs/phase-20/rollback-procedure.md`](docs/phase-20/rollback-procedure.md)

---

## 12. License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full copyright, permissions, and warranty terms.
