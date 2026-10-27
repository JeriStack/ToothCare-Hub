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
| **Frontend** | React, TypeScript/JSX, Vite, Tailwind CSS, shadcn/ui, Lucide React, React Router, Axios, React Hook Form, Zod | Directory & Dockerfile scaffolded; implementation scheduled for Phase 3 / Phase 5+ |
| **Backend API** | Native PHP (`^8.5`, pinned to `8.5.12-fpm-alpine3.24`), Composer, PDO | `composer.json` & Dockerfile configured; application routes/services scheduled for Phase 5+ |
| **Database** | MySQL 8.x (`InnoDB`, `utf8mb4`) / Local MariaDB 10.4 compatible | Compose service configured; SQL migrations (`001`–`008`+) scheduled for Phase 4 |
| **Email** | PHPMailer (`^6.9`) over SMTP + `email_outbox` CLI worker | Declared in `backend/composer.json`; worker scheduled for Phase 13 |
| **Real-Time** | Node.js (`20-alpine` / `22+`) + Socket.IO | Dockerfile & `.env.example` configured; server scheduled for Phase 14 |
| **API Docs** | OpenAPI 3.x (`zircote/swagger-php ^4.10`) + Swagger UI | Composer script configured; annotations scheduled for Phase 5 / Phase 17 |
| **Testing** | PHPUnit (`^11.3`), Vitest + React Testing Library | Configured in `.github/workflows/ci.yml`; suites expanded in Phases 4–16 |
| **Reverse Proxy & Containers** | Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`) + Nginx (`1.27-alpine`) | Compose & Nginx routing (`docker/nginx/conf.d/toothcare.conf`) configured |
| **Observability** | Prometheus + Grafana (provisioned datasource & dashboard) | Configured in `docker/prometheus/` & `docker/grafana/`; hardened in Phase 19 |
| **CI/CD** | GitHub Actions (`.github/workflows/ci.yml`) | Configured for PHP 8.5 & Node 20 checks |

---

## 4. Repository Directory Overview

| Path | Responsibility |
|---|---|
| `frontend/` | React + Vite single-page application (public landing page, auth, role dashboards, booking wizard) |
| `backend/` | Native PHP REST API (`/api/v1` controllers, services, PDO repositories, middleware, validators, jobs) |
| `realtime/` | Node.js + Socket.IO authenticated real-time notification service |
| `database/` | Ordered SQL migrations (`database/migrations/`), synthetic seeds (`database/seeds/`), and schema snapshot |
| `docker/` | Container build files and service configs (`php/`, `nginx/`, `prometheus/`, `grafana/`) |
| `nginx/` | Reverse proxy routing and security boundary documentation (`nginx/README.md`) |
| `monitoring/` | Prometheus scrape/alerting and Grafana provisioning documentation (`monitoring/README.md`) |
| `deployment/` | Deployment, rollback, health-check scripts, and Apache VirtualHost fallback example |
| `scripts/` | Windows PowerShell helper scripts for local setup, testing, and OpenAPI generation |
| `docs/` | Architecture, security, Phase 0 scope freeze (`docs/phase-0/`), and Phase 1 environment/workflow docs (`docs/phase-1/`) |
| `.github/` | GitHub Actions CI/CD workflows, issue templates (`bug_report.yml`, `feature_request.yml`), and PR template |

See [`docs/directory-structure.md`](docs/directory-structure.md) for the complete annotated tree.

---

## 5. Prerequisites

- **Git:** `2.40+` (Verified locally: `2.56.0.windows.2`)
- **Docker Engine / Docker Desktop + Compose:** Docker `26+` and Docker Compose (`docker-compose` / `docker compose`) for the canonical containerized stack (Verified locally: Docker `29.9.2`, Compose `v5.6.1`)
- **PHP & Composer (for direct host CLI / IDE checks):** PHP `8.5.x` (`>= 8.5.12` recommended for security fixes) with extensions `PDO`, `pdo_mysql`, `openssl`, `mbstring`, `json`, `curl`, `fileinfo`, and Composer `2.x`
- **Node.js & npm (for direct host CLI / IDE checks):** Node.js `20 LTS` / `22 LTS` / `24.x` and npm `10+`
- **MySQL 8.x (or XAMPP MariaDB 10.4+ for non-Docker fallback):** Canonical database runs in Docker (`mysql:8.0`); avoid running host MySQL on port `3306` simultaneously with the Docker `mysql` container.

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

### Validate Compose Configuration (Verified Working in Phase 1)
```powershell
docker-compose -f docker-compose.yml config -q
docker-compose -f docker-compose.yml -f docker-compose.prod.yml config -q
```
*(Note: Use `docker compose` or `docker-compose` depending on your shell alias; on Windows hosts where `docker-compose.exe` is installed standalone, `docker-compose` works directly).*

### Start and Stop the Containerized Stack (Active as Phase 2–5 Services Are Populated)
```powershell
# Start stack in background (use --build once frontend/realtime package.json files are populated in Phase 2+)
docker-compose up -d

# Inspect running containers and logs
docker-compose ps
docker-compose logs --tail=100

# Stop stack (preserves named database and monitoring volumes)
docker-compose down
```

### Direct Host Dependency Installation (Once Phase 2–5 Manifests Are Populated)
```powershell
# Backend (composer.json is present in Phase 1)
cd backend; composer install; cd ..

# Frontend & Realtime (populated in Phase 2 / Phase 5 / Phase 14)
cd frontend; npm install; cd ..
cd realtime; npm install; cd ..
```

---

## 8. Expected Local URLs and Port Assumptions

| Service | Local URL / Port | Status in Phase 1 | Exposure Policy |
|---|---|---|---|
| **App & API via Nginx** | `http://localhost:8080` | Configured in `docker-compose.yml` & `toothcare.conf` (serves app once built) | Public entry point (`80`/`443` in prod) |
| **REST API Base Path** | `http://localhost:8080/api/v1` | Planned (`backend/public/index.php` implemented in Phase 5) | Routed via Nginx FastCGI to `backend:9000` |
| **Vite Dev Server (Optional Host Mode)** | `http://localhost:5173` | Planned (active when running `npm run dev` in `frontend/`) | Localhost development only |
| **Socket.IO Realtime Service** | `http://localhost:4000` (or `/socket.io/` via `:8080`) | Configured in `docker-compose.yml` (implemented in Phase 14) | Proxied via Nginx `/socket.io/` in prod |
| **MySQL Database** | `localhost:3306` | Configured in `docker-compose.yml` | Internal-only in prod (`ports: []` in `docker-compose.prod.yml`) |
| **Prometheus UI** | `http://localhost:9090` | Configured in `docker-compose.yml` | Localhost / private monitoring network only |
| **Grafana UI** | `http://localhost:3000` | Configured in `docker-compose.yml` | Localhost / authenticated admin access only |

---

## 9. Testing Commands (Planned / Phase-Gated)

Once the respective test suites and `package.json` / `phpunit.xml` configurations are populated in Phases 4–16:

```powershell
# Backend unit & integration tests (PHPUnit)
cd backend; ./vendor/bin/phpunit; cd ..

# OpenAPI specification generation & validation
cd backend; composer run openapi; cd ..

# Frontend component tests & lint (Vitest / ESLint)
cd frontend; npm test; npm run lint; cd ..

# Realtime service event & auth tests
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
- **Reference & Security Guides:**
  - [`docs/directory-structure.md`](docs/directory-structure.md)
  - [`docs/security-checklist.md`](docs/security-checklist.md)
  - [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## 12. License

See [LICENSE](LICENSE).
