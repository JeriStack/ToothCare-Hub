# Contributing to ToothCare Hub

Thank you for contributing to **ToothCare Hub** (*Healthier Smiles. Brighter Futures.*).

This guide explains the repository workflow, local setup, coding and architectural standards, testing gates, and pull-request expectations across the PHP API, React frontend, Node.js Socket.IO real-time service, MySQL migrations, and Docker infrastructure.

---

## 1. Core Architectural Rules

Every contribution must preserve these system-wide invariants:

- **PHP + MySQL are the authoritative sources of truth.** Enforce authentication, DRBAC permissions, resource ownership, and appointment lifecycle rules server-side in native PHP (`backend/`).
- **Real-time and email delivery are post-commit side effects.** Persist in-app notifications, `email_outbox`, and `realtime_outbox` rows inside the MySQL transaction; never publish Socket.IO events or send SMTP mail before commit, and never let external outages roll back a committed appointment.
- **No sensitive data in logs, URLs, browser storage, or Socket.IO payloads.** Never expose passwords, session cookies, raw connection tickets, clinical diagnoses, or patient PII in logs, query strings, `localStorage`/`sessionStorage`, or real-time event payloads.
- **Theme & Responsive UI Parity.** Keep **Light Mode** as the default theme and **Dark Mode** as an explicit user-selected preference (`toothcare_theme`). Do not introduce an unapproved System/Auto theme mode. All UI changes must work cleanly across Light/Dark themes and mobile (`320px–430px`), tablet (`768px–1024px`), and desktop (`1280px–1920px`) viewports without horizontal overflow.

---

## 2. Local Development Setup

### Prerequisites
- **PHP 8.5+** (`pdo`, `pdo_mysql`, `pdo_sqlite`, `json`, `openssl`, `mbstring`, `fileinfo`) and **Composer 2.x**
- **Node.js 24 LTS** and **npm 10+**
- **Docker Engine / Docker Desktop** with Compose v2 (for MySQL 8.0, Nginx, Mailpit, Prometheus/Grafana)

### Environment Bootstrap
Copy the safe placeholder templates (never commit `.env` files or real secrets):

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp realtime/.env.example realtime/.env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
Copy-Item realtime/.env.example realtime/.env
```

Generate a shared 32+ character secret for `REALTIME_INTERNAL_SECRET` and set it identically in `.env`, `backend/.env`, and `realtime/.env`.

### Install Dependencies & Apply Migrations

```bash
composer --working-dir=backend install
npm --prefix frontend install
npm --prefix realtime install
php database/migrate.php
```

---

## 3. Branching & Commit Conventions

### Branching Strategy
- `main` — stable, release-ready branch protected by CI checks.
- `development` (and `develop`) — active integration branch for ongoing phase work; open feature/fix PRs here before promoting to `main`.

### Branch Naming
Use short, descriptive, kebab-case branch names prefixed by type:

- `feature/<name>` — new functionality
- `fix/<name>` — bug fixes
- `refactor/<name>` — behavior-preserving structural improvements
- `chore/<name>` — tooling, dependencies, CI, or infrastructure changes
- `docs/<name>` — documentation updates only
- `test/<name>` — test-only additions or fixes

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/) in the imperative mood, keeping the subject line under 72 characters:

```text
feat(appointments): add real-time slot conflict locking
fix(auth): reject expired verification tokens
feat(realtime): add HMAC-SHA256 replay protection for internal publisher
test(backend): use relative future dates in DentistAppointmentAuthorizationTest
docs(phase-14): document Socket.IO ticket lifecycle and recovery
```

Common scopes: `appointments`, `auth`, `backend`, `db`, `docker`, `email`, `frontend`, `realtime`, `security`, `ui`.

---

## 4. Coding & Engineering Standards

- **Backend (Native PHP 8.5):**
  - `declare(strict_types=1);`, PSR-12 formatting, 4-space indentation.
  - PDO prepared statements only — never interpolate untrusted input into SQL.
  - Keep controllers thin; place business logic and transactions in `backend/src/Services/` and SQL queries in `backend/src/Repositories/`.
  - Use explicit DRBAC permissions (`AuthorizationMiddleware::hasPermission(...)`) and strict ownership checks on all protected endpoints.
  - Enforce server-side pagination (`per_page` / `limit`, max `100`) with deterministic primary-key tie-breakers (`ORDER BY ..., id DESC|ASC`) on all potentially growing list endpoints.
  - Use relative dates in tests (e.g., `DateTimeImmutable` in `Asia/Manila`) instead of hardcoded future dates that expire over time.

- **Real-Time Service (Node.js + TypeScript + Socket.IO in `realtime/`):**
  - Strict TypeScript (`"strict": true`, 2-space indentation).
  - Never trust client-supplied user IDs, roles, or room names; compute rooms server-side from PHP-verified identities.
  - Keep internal endpoints (`/internal/publish`, `/internal/revoke`) protected with HMAC-SHA256 signatures and replay protection, bound to the private Docker network.

- **Frontend (React + Vite + Tailwind CSS in `frontend/`):**
  - 2-space indentation, functional components, semantic HTML, and accessible keyboard/focus management.
  - Reuse shared UI primitives (`frontend/src/components/ui/`), skeleton screens (`frontend/src/components/skeletons/`), and semantic theme tokens from `frontend/src/styles/global.css`.
  - Clean up all timers, event listeners, and real-time subscriptions on component unmount and logout.

- **Database Migrations (`database/migrations/`):**
  - Migrations must be numbered sequentially (`NNN_description.sql`), idempotent where safe, and paired with a reversible rollback script in `database/migrations/rollback/NNN_description.down.sql`.
  - Whenever you add or alter tables/columns, update `backend/tests/Support/TestDb.php` so the in-memory SQLite PHPUnit suite stays aligned with MySQL 8.0.

- **API Contract (`backend/openapi/openapi.yaml`):**
  - Document all public `/api/v1/*` routes, request/response schemas, and error envelopes in `backend/openapi/openapi.yaml`.
  - Do **not** expose internal service-to-service routes (`/api/v1/internal/*`) as public OpenAPI endpoints.

---

## 5. Verification Commands (Before Opening a PR)

Run the relevant checks locally before requesting review. These mirror `.github/workflows/ci.yml`:

### Backend (PHP)
```bash
composer --working-dir=backend validate --strict
php backend/vendor/bin/phpunit -c backend/phpunit.xml
php backend/scripts/validate-openapi.php
php backend/bin/email-worker.php --help
php backend/bin/realtime-worker.php --help
```

### Real-Time Service (Node.js + Socket.IO)
```bash
npm --prefix realtime run typecheck
npm --prefix realtime run build
npm --prefix realtime test
```

### Frontend (React + Vite)
```bash
npm --prefix frontend test -- --run
npm --prefix frontend run build
npx --prefix frontend vitest run src/tests/components/ResponsiveContracts.test.jsx
```

Optional browser E2E verification (requires Playwright Chromium):
```bash
npm --prefix frontend run test:e2e:local
```

### Infrastructure (Docker Compose)
```bash
docker compose -f compose.yaml -f compose.dev.yaml config -q
docker compose -f compose.yaml -f compose.prod.yaml config -q
```

---

## 6. Pull Request Checklist

Keep pull requests focused, small, and linked to an issue or roadmap phase using `.github/pull_request_template.md`. Before requesting review, confirm:

- [ ] Scope, root cause, and architectural impact are clearly described.
- [ ] Unit and integration tests were added or updated and pass (`PHPUnit`, `realtime` tests, `Vitest`).
- [ ] Database migrations (and rollbacks) are included and `TestDb.php` is updated where applicable.
- [ ] Public API changes are documented in `backend/openapi/openapi.yaml` and pass `validate-openapi.php`.
- [ ] UI changes include desktop/mobile screenshots in both Light Mode and Dark Mode.
- [ ] Security and privacy reviewed (authentication, DRBAC permissions, ownership, input validation, no PII/clinical leaks).
- [ ] No real `.env` files, secrets, credentials, or patient data are committed.
- [ ] All CI checks pass (Infrastructure, Backend, Migrations, Realtime, Frontend).

---

## 7. Review Process & Documentation

- At least **one approving review** and a **green CI pipeline** are required before merging into `main`, `develop`, or `development`.
- Update relevant documentation in [`docs/`](docs/README.md) when changing architecture, environment variables, deployment topology, or operational runbooks.
- All participants must follow our [Code of Conduct](CODE_OF_CONDUCT.md).
- For security vulnerabilities or sensitive findings, please follow our [Security Policy](SECURITY.md) rather than opening a public issue.
