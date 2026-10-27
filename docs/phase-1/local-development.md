# ToothCare Hub — Phase 1 Local Development & Startup Guide

**Document ID:** `TCH-P1-LOCAL-DEV-001`  
**Version:** `1.0`  
**Phase:** `Phase 1 — Repository, Local Environment, and Team Workflow`  
**Prepared Date:** `2026-10-27`

---

## 1. Current Implementation Status vs. Phase-Gated Commands

In accordance with Phase 1 rules, this guide distinguishes between **what is configured and verified today in Phase 1** and **what becomes runnable as application code is added in Phases 2–14**:

- **Verified Working in Phase 1:**
  - Git repository, branch workflow, `.gitignore`, and all four `.dockerignore` files.
  - All four `.env.example` templates and local `.env` copy workflow.
  - Docker Compose syntax validation (`docker-compose -f docker-compose.yml config -q` and `docker-compose -f docker-compose.yml -f docker-compose.prod.yml config -q`).
  - Host PHP `8.5.12` CLI, Composer `2.10.2` (`composer validate --strict`), Node.js `v24.19.0`, and npm `12.0.2`.
- **Phase-Gated (Active in Phases 2–14):**
  - Full container builds (`docker-compose up -d --build`) require `frontend/package.json` and `realtime/package.json` (currently `0-byte` scaffolds in Phase 1, populated in Phase 2/5/14).
  - Database migrations (`database/migrations/*.sql`) and seeders are populated in Phase 4.
  - `/api/v1/health` and REST API endpoints (`backend/public/index.php`) are populated in Phase 5.

---

## 2. Step-by-Step Local Setup Process

### Step 1: Clone the Repository
```powershell
git clone git@github.com:Palinje/ToothCare-Hub.git
cd ToothCare-Hub
git status --short --branch
```

### Step 2: Copy Environment Templates
```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
Copy-Item realtime/.env.example realtime/.env
```

### Step 3: Configure Local Environment Values
Open `.env`, `backend/.env`, `frontend/.env`, and `realtime/.env` in VS Code and set local development values (see [`docs/phase-1/environment-configuration.md`](environment-configuration.md)). Confirm that `git status` does **not** list any `.env` file as untracked or staged.

### Step 4: Start Docker Desktop & Validate Compose Configuration
Ensure Docker Desktop is running on Windows, then validate the Compose files:

```powershell
# Note: On Windows hosts where standalone docker-compose.exe is on PATH, use docker-compose
# (or 'docker compose' if Compose v2 CLI subcommand is enabled in Docker Desktop)
docker-compose -f docker-compose.yml config -q
docker-compose -f docker-compose.yml -f docker-compose.prod.yml config -q
```

### Step 5: Build and Start Services (Phase 2+ Once Package Manifests Are Populated)
```powershell
# Build and start all services in detached mode
docker-compose up -d --build

# Check container status and health
docker-compose ps

# Tail recent logs across services
docker-compose logs --tail=100
```

### Step 6: Install Dependencies for Local IDE / CLI Tooling
```powershell
# Backend Composer dependencies (backend/composer.json is configured in Phase 1)
cd backend
composer validate --strict
composer install
cd ..

# Frontend & Realtime dependencies (run once package.json files are populated in Phase 2+)
cd frontend
npm install
cd ..

cd realtime
npm install
cd ..
```

### Step 7: Run Health Checks & Access Local Endpoints (Phase 2 / Phase 5+)

| Target | Expected Local URL | Status | Notes |
|---|---|---|---|
| **Frontend SPA & Reverse Proxy (Nginx)** | `http://localhost:8080` | Configured in Compose (`8080:80`) | Serves React build once `frontend` image is built |
| **API Health Check** | `http://localhost:8080/api/v1/health` | Planned (Phase 5) | Routed via Nginx FastCGI to `backend:9000` |
| **Swagger UI (Development Only)** | `http://localhost:8080/docs/swagger-ui.html` *(or local route)* | Planned (Phase 5 / Phase 17) | Reads `backend/docs/openapi.yaml` |
| **Vite Dev Server (Optional Host HMR)** | `http://localhost:5173` | Planned (Phase 5) | Active when running `npm run dev` in `frontend/` |
| **Socket.IO Service** | `http://localhost:4000` (or `ws://localhost:8080/socket.io/`) | Configured in Compose (`4000:4000`) | Implemented in Phase 14 |
| **Prometheus UI** | `http://localhost:9090` | Configured in Compose (`9090:9090`) | Scrapes configured targets in `docker/prometheus/prometheus.yml` |
| **Grafana Dashboards** | `http://localhost:3000` | Configured in Compose (`3000:3000`) | Uses `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` from `.env` |

### Step 8: Stop Services Safely
```powershell
# Stop and remove containers while preserving named volumes (mysql-data, prometheus-data, grafana-data)
docker-compose down
```
> **Warning:** Do **not** pass `-v` (`docker-compose down -v`) unless you intentionally want to wipe your local MySQL database and monitoring volumes.

---

## 3. Troubleshooting Guide

### 3.1 Port Conflicts (`8080`, `3306`, `4000`, `9090`, `3000`)
- **Symptom:** `Bind for 0.0.0.0:3306 failed: port is already allocated` or port `8080` is busy.
- **Cause:** Local XAMPP MySQL (`3306`) or another web service is already listening on the host port.
- **Fix:** Check active listeners with:
  ```powershell
  Get-NetTCPConnection -State Listen -LocalPort 80,3306,4000,5173,8080,9090,3000 -ErrorAction SilentlyContinue
  ```
  Stop the conflicting XAMPP service from the XAMPP Control Panel, or adjust the host port mapping in your local `.env` / Compose override.

### 3.2 Docker Daemon Not Running or `docker compose` Command Not Found
- **Symptom:** `error during connect: ... open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` or `docker: unknown command: docker compose`.
- **Fix:**
  1. Launch **Docker Desktop** from the Windows Start Menu and wait for the engine indicator to turn green.
  2. On Windows hosts where `docker-compose.exe` (`v5.6.1`) is installed in `DockerDesktop\resources\bin`, run `docker-compose` (with a hyphen) or enable *Use Docker Compose V2* in Docker Desktop settings.

### 3.3 Missing Environment Values
- **Symptom:** Database connection errors or blank `VITE_API_BASE_URL` in the frontend.
- **Fix:** Verify all four `.env` files exist (`.env`, `backend/.env`, `frontend/.env`, `realtime/.env`) and compare their keys against the corresponding `.env.example` templates.

### 3.4 PHP Extension Problems
- **Symptom:** `Composer` or `PDO` fails with `could not find driver` or missing extension errors.
- **Fix:** Run `php --ini` and `php -m` to confirm which PHP binary is first on `PATH` (`C:\php-8.5.12\php.exe` vs `C:\xampp\php\php.exe`). Ensure `extension=pdo_mysql`, `extension=openssl`, `extension=mbstring`, `extension=curl`, and `extension=fileinfo` are enabled in the active `php.ini`.

### 3.5 Composer Dependency Errors
- **Symptom:** `Your requirements could not be resolved to an installable set of packages` due to PHP version mismatch.
- **Fix:** `backend/composer.json` targets `"php": "^8.5"`. Ensure `php -v` reports PHP `8.5.x` (`C:\php-8.5.12\php.exe`) or run Composer inside the `backend` container (`docker-compose run --rm backend composer install`).

### 3.6 Node.js / npm Incompatibility
- **Symptom:** `npm ci` fails or package lockfile version mismatch occurs.
- **Fix:** Confirm `node -v` is `>= 20.x` (verified `v24.19.0` on host) and `npm -v` is `>= 10.x` (`12.0.2`). Run `npm install` when initializing `package-lock.json` for the first time, then use `npm ci` in CI and Dockerfiles.

### 3.7 Database Readiness and Connection Failures
- **Symptom:** `SQLSTATE[HY000] [2002] Connection refused` immediately after `docker-compose up -d`.
- **Cause:** A running `mysql` container takes several seconds to initialize InnoDB before accepting TCP connections.
- **Fix:** Check `docker-compose logs mysql` until `ready for connections` appears before running migrations. Inside Docker Compose, set `DB_HOST=mysql` in `backend/.env`; when running PHP scripts directly on the Windows host, set `DB_HOST=127.0.0.1`.

### 3.8 File Permission / Windows Line-Ending (`CRLF`) Problems
- **Symptom:** Shell scripts (`deployment/scripts/*.sh`) fail inside Linux containers with `/bin/sh^M: bad interpreter` or `backend/storage/logs` is not writable.
- **Fix:** Keep `.editorconfig` active (`end_of_line = lf` for `.sh` files) and ensure `backend/storage/logs` and `backend/storage/cache` are writable by the `www-data` user inside the `backend` container.

