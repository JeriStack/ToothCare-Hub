# ToothCare Hub

**Brand Tagline:** *Healthier Smiles. Brighter Futures.*

A responsive web-based dental appointment and clinic management system. ToothCare Hub replaces manual appointment handling with a structured digital workflow where **MySQL (`InnoDB`) and the native PHP REST API (`/api/v1`) serve as the authoritative system of record**, supported by a **React + Vite** frontend, **PHPMailer** asynchronous email outbox processing, **Node.js + Socket.IO** real-time notifications, **Docker Compose + Nginx** containerization, and **Prometheus + Grafana** observability.

---

## 1. Project Objectives

1. **Prevent Conflicting Bookings:** Enforce dentist schedules, time-off blocks, and variable service durations using server-side validation and transaction-safe InnoDB row locking (`SELECT ... FOR UPDATE`).
2. **Enforce Least-Privilege Role Boundaries:** Re-validate authentication, role permissions, and resource ownership on every `/api/v1/*` request.
3. **Isolate Notification Side Effects:** Persist in-app notifications and `email_outbox` rows inside the booking transaction; deliver SMTP emails and Socket.IO broadcasts only after commit so external outages never roll back a saved appointment.
4. **Provide Reproducible Delivery & Observability:** Package services with Docker Compose behind an Nginx reverse proxy, gate changes with GitHub Actions CI, and monitor service health with Prometheus and Grafana.

---

## 2. Target Users & Roles

- **Admin / Receptionist (`ADMIN`):** Manages patient records, dentist profiles, dental services/pricing, and dentist working schedules; reviews pending appointment requests (`CONFIRMED` / `REJECTED`); monitors clinic KPIs and filtered reports.
- **Dentist (`DENTIST`):** Views assigned daily and upcoming appointments; accesses permitted patient visit context; records clinical diagnosis and treatment notes; marks eligible visits `COMPLETED`.
- **Patient (`PATIENT`):** Registers or signs in; browses active dental services and dentists; checks available time slots; submits appointment requests through a guided 6-step wizard; tracks appointment status (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`); cancels within clinic policy rules.

---

## 3. Technology Stack

| Layer | Technology | Current Implementation Status |
|---|---|---|
| **Frontend** | React, TypeScript/JSX, Vite, Tailwind CSS, shadcn/ui, Lucide React, React Router, Axios, React Hook Form, Zod | Phase 2 containerized SPA static bundle mounted at `/var/www/frontend/dist`; feature development in Phase 5+ |
| **Backend API** | Native PHP (`^8.5`, pinned to `8.5.12-fpm-alpine3.24`), Composer, PDO | Phase 2 containerized image built; front controller responsive to `/api/v1/health` & `/api/v1/metrics`; feature routes in Phase 5+ |
| **Database** | MySQL 8.x (`InnoDB`, `utf8mb4`) | Phase 2 containerized service active with persistent volume `toothcare_mysql_data` & `mysqladmin ping` readiness check |
| **Email Worker** | PHPMailer (`^6.9`) over SMTP + `email_outbox` CLI worker | Phase 2 dedicated background worker daemon (`backend/src/Jobs/ProcessEmailOutbox.php`) reusing PHP image |
| **Real-Time** | Node.js (`20-alpine`) + Socket.IO (`^4.8.1`) | Phase 2 containerized service active with non-root user, `/health`, `/metrics`, and `/socket.io/` proxying |
| **Reverse Proxy** | Nginx (`1.27-alpine`) | Phase 2 primary edge entry point; SPA fallback, FastCGI `/api/` routing, WebSocket proxying, and security headers |
| **Containerization** | Docker Compose v2 (`compose.yaml`, `compose.dev.yaml`, `compose.prod.yaml`) | Fully implemented and verified in Phase 2 |
| **Observability** | Prometheus (`v2.53.1`) + Grafana (`11.1.0`) + `mysqld-exporter` | Configured under optional Compose profile `monitoring` |
| **CI/CD** | GitHub Actions (`.github/workflows/ci.yml`) | Automated Docker Compose config, PHP, Node, and test validation on `main`, `develop`, `development` |

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
| `docs/` | Architecture, security, Phase 0 specs (`docs/phase-0/`), Phase 1 setup (`docs/phase-1/`), and Phase 2 runbook (`docs/phase-2-implementation.md`) |
| `.github/` | GitHub Actions CI/CD workflows, issue templates, and PR template |

---

## 5. Prerequisites

- **Git:** `2.40+` (Verified locally: `2.56.0.windows.2`)
- **Docker Engine / Docker Desktop + Compose:** Docker `26+` and Docker Compose v2 (Verified locally: Docker `29.9.2`, Compose `v5.6.1`)
- **PHP & Composer (for direct host CLI / IDE checks):** PHP `8.5.x` (`>= 8.5.12` recommended) with extensions `PDO`, `pdo_mysql`, `openssl`, `mbstring`, `json`, `curl`, `fileinfo`, and Composer `2.x`
- **Node.js & npm (for direct host CLI / IDE checks):** Node.js `20 LTS` / `22 LTS` / `24.x` and npm `10+`
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
- See [`docs/phase-1/environment-configuration.md`](docs/phase-1/environment-configuration.md) for full variable documentation.

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
# Start services with Prometheus, Grafana, and MySQL exporter enabled
docker compose --profile monitoring up -d

# Stop monitoring profile
docker compose --profile monitoring down
```

### 7.4 Service Management & Verification
```powershell
# Validate Nginx configuration syntax inside container
docker compose exec nginx nginx -t

# Rebuild an individual service without stopping others
docker compose build php-fpm
docker compose up -d --no-deps php-fpm
```

---

## 8. Expected Local URLs and Port Assumptions

| Service | Local URL / Port | Exposure Policy | Expected Response |
|---|---|---|---|
| **App & Landing via Nginx** | `http://localhost:8080/` | Public entry point | Interactive ToothCare Hub dashboard & diagnostics |
| **Nginx Health Check** | `http://localhost:8080/health` | Public entry point | `{"status":"healthy","service":"toothcare-nginx"}` |
| **REST API Health Check** | `http://localhost:8080/api/v1/health` | Routed via Nginx FastCGI | `{"status":"healthy","service":"toothcare-backend","database":"connected"}` |
| **Prometheus Metrics** | `http://localhost:8080/api/v1/metrics` | Routed via Nginx FastCGI | Prometheus text format exporter metrics |
| **Socket.IO Realtime Service** | `http://localhost:8080/socket.io/` | Proxied via Nginx WebSocket | Handshake / `system:connected` event |
| **MySQL Database** | `127.0.0.1:3306` (dev only) | Private internal network | MySQL 8.0 server (no external exposure) |
| **Prometheus UI** | `http://127.0.0.1:9090` | Monitoring profile only | Prometheus metrics query interface |
| **Grafana UI** | `http://127.0.0.1:3000` | Monitoring profile only | Grafana dashboard (default admin/admin) |

---

## 9. Testing Commands

```powershell
# Backend unit & integration tests (PHPUnit)
cd backend; ./vendor/bin/phpunit; cd ..

# OpenAPI specification generation & validation
cd backend; composer run openapi; cd ..

# Frontend component tests & lint (Vitest / ESLint)
cd frontend; npm test; cd ..

# Realtime service tests
cd realtime; npm test; cd ..
```

---

## 10. Git Branch, Commit, and Contribution Conventions

- **Branches:** `main` (stable/releasable), `development` / `develop` (integration), `feature/<short-description>`, `fix/<short-description>`, `docs/<short-description>`, `chore/<short-description>`.
- **Commits:** Imperative conventional commits under ~70 characters (e.g., `feat(appointments): validate slot conflicts`, `fix(auth): reject invalid session`, `docs(phase-1): document local environment`).
- **Pull Requests:** Must complete all checkboxes in [`.github/pull_request_template.md`](.github/pull_request_template.md) and pass CI checks.
- See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/phase-1/git-workflow.md`](docs/phase-1/git-workflow.md) for complete rules.

---

## 11. Project Documentation Index

- **Phase 0 — Project Initiation & Scope Freeze:**
  - [`docs/phase-0/project-brief.md`](docs/phase-0/project-brief.md)
  - [`docs/phase-0/mvp-scope.md`](docs/phase-0/mvp-scope.md)
  - [`docs/phase-0/requirements-register.md`](docs/phase-0/requirements-register.md)
  - [`docs/phase-0/role-permission-matrix.md`](docs/phase-0/role-permission-matrix.md)
  - [`docs/phase-0/appointment-policy-decisions.md`](docs/phase-0/appointment-policy-decisions.md)
  - [`docs/phase-0/runtime-compatibility.md`](docs/phase-0/runtime-compatibility.md)
  - [`docs/phase-0/risk-and-assumptions-register.md`](docs/phase-0/risk-and-assumptions-register.md)
  - [`docs/phase-0/phase-0-exit-checklist.md`](docs/phase-0/phase-0-exit-checklist.md)
- **Phase 1 — Repository, Local Environment & Team Workflow:**
  - [`docs/phase-1/environment-assessment.md`](docs/phase-1/environment-assessment.md)
  - [`docs/phase-1/environment-configuration.md`](docs/phase-1/environment-configuration.md)
  - [`docs/phase-1/docker-context-security.md`](docs/phase-1/docker-context-security.md)
  - [`docs/phase-1/git-workflow.md`](docs/phase-1/git-workflow.md)
  - [`docs/phase-1/local-development.md`](docs/phase-1/local-development.md)
  - [`docs/phase-1/phase-1-exit-checklist.md`](docs/phase-1/phase-1-exit-checklist.md)
- **Phase 2 — Dockerized Development Environment and Nginx Reverse Proxy:**
  - [`docs/phase-2-implementation.md`](docs/phase-2-implementation.md)
- **Reference & Security Guides:**
  - [`docs/directory-structure.md`](docs/directory-structure.md)
  - [`docs/security-checklist.md`](docs/security-checklist.md)
  - [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## 12. License

See [LICENSE](LICENSE).
