# ToothCare Hub — Phase 2 Implementation & Verification Report
**Document ID:** `TOOTHCARE-DOC-PHASE-2-IMPL`  
**Version:** 1.0.0  
**Phase:** Phase 2 — Dockerized Development Environment and Nginx Reverse Proxy  
**Author:** DevOps & Architecture Team  
**Date:** 2026-10-27  

---

## 1. Executive Summary

Phase 2 establishes a fully containerized, reproducible development and staging foundation for **ToothCare Hub** using Docker Compose v2. All service boundaries follow least-privilege exposure rules: only Nginx publishes public web traffic (port `8080` in development, `80/443` in production), while MySQL, PHP-FPM, Node.js Socket.IO, and the background email worker operate on isolated private bridge networks with health-check readiness gates.

---

## 2. Service Architecture and Network Topology

```
                              [ Public Traffic ]
                                      │
                         HTTP :8080   │   (or :80/:443 in Prod)
                                      ▼
                   ┌──────────────────────────────────────┐
                   │            nginx (Alpine)            │
                   │   - Static React SPA (/dist)         │
                   │   - Reverse Proxy & Security Headers │
                   │   - Self Health: GET /health         │
                   └──────┬────────────────────────┬──────┘
                          │                        │
         FastCGI :9000    │                        │ WebSocket Upgrade :4000
       (edge & app net)   │                        │ (edge & app net)
                          ▼                        ▼
     ┌───────────────────────────────┐   ┌───────────────────────────────┐
     │       php-fpm (PHP 8.5)       │   │      realtime (Node 20)       │
     │  - REST API Front Controller  │   │  - Socket.IO Server           │
     │  - MySQL PDO Driver           │   │  - Unprivileged `node` user   │
     │  - Health: /api/v1/health     │   │  - Health: /health            │
     └──────────────┬────────────────┘   └───────────────────────────────┘
                    │
         TCP :3306  │ (app network only; no public exposure)
                    ▼
     ┌───────────────────────────────┐   ┌───────────────────────────────┐
     │          mysql (8.0)          │   │      email-worker (CLI)       │
     │  - Authoritative Relational DB│   │  - Reuses PHP 8.5 Image       │
     │  - Persistent Named Volume    │   │  - Polls email_outbox queue   │
     │  - Readiness: mysqladmin ping │   │  - Managed Daemon Loop        │
     └───────────────────────────────┘   └──────────────┬────────────────┘
                                                        │
                                      (app network) ────┘
```

### Network Isolation Grid

| Network | Driver | Member Services | Description |
| :--- | :--- | :--- | :--- |
| `toothcare_edge` (`edge`) | Bridge | `nginx`, `frontend` (dev profile) | Public-facing boundary. Terminated at Nginx proxy. |
| `toothcare_app` (`app`) | Bridge | `nginx`, `php-fpm`, `mysql`, `realtime`, `email-worker`, `mysqld-exporter` | Private inter-container application communications. |
| `toothcare_monitoring` (`monitoring`) | Bridge | `prometheus`, `grafana`, `mysqld-exporter` | Optional telemetry scrape network, completely isolated from edge. |

### Storage Volumes

| Volume Name | Type | Mount Point | Retention Policy |
| :--- | :--- | :--- | :--- |
| `toothcare_mysql_data` | Named Volume | `/var/lib/mysql` | Persistent across container updates and restarts. |
| `toothcare_prometheus_data` | Named Volume | `/prometheus` | Stores metric timeseries data. |
| `toothcare_grafana_data` | Named Volume | `/var/lib/grafana` | Stores Grafana dashboard state and preferences. |

---

## 3. Implementation Checklist

- [x] **Repository Audit:** Verified existing Phase 0 & Phase 1 assets, Git clean status, and absence of conflicting ports.
- [x] **Base Compose (`compose.yaml`):** Standardized Compose v2 definition with `nginx`, `php-fpm`, `mysql`, `realtime`, `email-worker`, and optional `monitoring` profile.
- [x] **Development Overlay (`compose.dev.yaml`):** Configured hot-reloading bind mounts (`./backend`, `./realtime`) and debugging ports bound strictly to `127.0.0.1`.
- [x] **PHP-FPM Dockerfile (`docker/php/Dockerfile`):** Pinned to `php:8.5.12-fpm-alpine3.24`, installed `pdo_mysql`, OPcache enabled, CVE-2026-115560 hardening applied, unprivileged permissions configured.
- [x] **Real-Time Dockerfile (`realtime/Dockerfile`):** Pinned to `node:20-alpine`, runs as non-root `USER node`, reproducible `npm ci`, and built-in healthcheck.
- [x] **Nginx Proxy Configuration (`nginx/conf.d/toothcare.conf`):** SPA fallback for client-side routing, FastCGI `/api/` routing to `php-fpm:9000`, WebSocket proxying to `realtime:4000`, and direct `/health` status endpoint.
- [x] **Minimal Front Controller (`backend/public/index.php`):** Responsive to `/api/v1/health` with live PDO MySQL connectivity test and Prometheus metrics format `/api/v1/metrics`.
- [x] **Background Email Worker (`backend/src/Jobs/ProcessEmailOutbox.php`):** Non-blocking polling daemon reusing backend PHP container with signal handling.
- [x] **Minimal Realtime Server (`realtime/src/server.js`):** Socket.IO WebSocket server with CORS support, connection tracking, `/health`, and `/metrics` endpoints.
- [x] **Static Frontend Landing Page (`frontend/dist/index.html`):** Beautiful interactive UI implementing ToothCare Hub design tokens (Deep Navy `#12304A`, Teal `#0D9488`, Soft Teal `#CCFBF1`, Canvas `#F5F8FA`) with live diagnostic buttons.
- [x] **Security Exclusions (`.dockerignore`):** Independent exclusion manifests preventing leaks of `.git`, `.env*`, keys, logs, and `node_modules`/`vendor`.
- [x] **Monitoring Isolation:** Prometheus and Grafana gated behind `profiles: ["monitoring"]`.

---

## 4. Developer Runbook & Operations

### 4.1 Prerequisites
- Docker Desktop with WSL 2 backend (Windows) or Docker Engine 24+ & Compose v2 (Linux/macOS).
- Minimum 4 GB RAM allocated to Docker.

### 4.2 Starting the Environment

```bash
# 1. Prepare environment variables from templates
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item realtime/.env.example realtime/.env
Copy-Item frontend/.env.example frontend/.env

# 2. Build and start baseline development services
docker compose -f compose.yaml -f compose.dev.yaml up -d --build

# 3. Verify container status and health
docker compose ps
```

### 4.3 Service URLs

| Service / Route | URL | Expected Response |
| :--- | :--- | :--- |
| **Frontend Web App** | `http://localhost:8080/` | Interactive ToothCare Hub dashboard & diagnostics |
| **Nginx Health Check** | `http://localhost:8080/health` | `{"status":"healthy","service":"toothcare-nginx","timestamp":"..."}` |
| **Backend API Health** | `http://localhost:8080/api/v1/health` | `{"status":"healthy","service":"toothcare-backend","database":"connected"}` |
| **Socket.IO Endpoint** | `http://localhost:8080/socket.io/` | WebSocket connection handshake / `system:connected` |
| **Prometheus (if enabled)** | `http://127.0.0.1:9090` | Prometheus web UI (monitoring profile only) |
| **Grafana (if enabled)** | `http://127.0.0.1:3001` | Grafana dashboard login (default admin/admin, monitoring profile only) |

### 4.4 Operational Commands

```bash
# View aggregated service logs
docker compose logs -f

# View specific service logs
docker compose logs -f nginx php-fpm realtime email-worker mysql

# Test Nginx configuration syntax inside container
docker compose exec nginx nginx -t

# Rebuild an individual service without stopping others
docker compose build php-fpm
docker compose up -d --no-deps php-fpm

# Start optional monitoring stack
docker compose --profile monitoring up -d

# Stop all services (preserves database volume)
docker compose down

# Safe database backup
docker compose exec mysql mysqldump -u root -p toothcare_hub > backup_$(Get-Date -Format "yyyyMMdd").sql

# Reset environment and wipe database (DESTRUCTIVE - USE WITH CAUTION)
docker compose down -v
```

---

## 5. Security & Verification Matrix

1. **Least Privilege Network Binding:** MySQL (3306), PHP-FPM (9000), Realtime (4000), and Exporters are inaccessible externally. In development, debugging ports are bound strictly to `127.0.0.1`.
2. **Hardened File System Access:** Nginx explicitly denies all requests targeting `.env`, `.git`, `.yaml`, `.sql`, `config/`, `src/`, `tests/`, `vendor/`, and `storage/`.
3. **Container User Isolation:** Real-time container executes as unprivileged `node` user (UID 1000). PHP-FPM executes under `www-data`.
4. **Volume Data Protection:** Database volume `toothcare_mysql_data` is decoupled from container lifecycle, surviving restarts and image updates.
