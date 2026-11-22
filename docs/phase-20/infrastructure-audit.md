# Phase 20 — Infrastructure & Containerization Audit

## 1. Pre-Phase 20 Findings & Gaps Identified

| Area | Pre-Phase 20 State | Risk | Phase 20 Remediation |
|---|---|---|---|
| **Compose Source Bind Mounts** | Base `compose.yaml` mounted `./backend:/var/www/backend`, `./nginx/*`, `./frontend/dist`, and published `mysql` port `3306:3306`, leaking dev mounts/ports into `compose.prod.yaml`. | High | Moved dev bind mounts and `127.0.0.1:3306` exclusively to `compose.dev.yaml`; base `compose.yaml` uses named `backend-storage` volume only. |
| **PHP Backend Dockerfile** | Single-stage `docker/php/Dockerfile` kept Composer binary in runtime image, copied `tests/`, and silenced install errors with `|| true`. | High | Converted to 2-stage build (`composer:2.8` → `php:8.5.12-fpm-alpine3.24`), removed Composer from runtime, enabled OPcache, failed fast on lockfile errors, excluded `tests/`. |
| **Production Nginx Config** | `docker/nginx/conf.d/toothcare.conf` was stale (missing `/api/v1/internal/` & `/api/v1/metrics` blocks, missing internal port `8081`, missing immutable `/assets/` cache, deprecated `X-XSS-Protection`). | High | Created hardened `docker/nginx/production.conf` + `production-tls.conf.example`; updated `docker/nginx/Dockerfile` to bake compiled React `dist/` + hardened config; sanitized `nginx/nginx.conf` access logs (`$uri` instead of `$request_uri`). |
| **Realtime Dockerfile** | `realtime/Dockerfile` used `npm install` instead of deterministic `npm ci`. | Medium | Switched both stages to `npm ci` / `npm ci --omit=dev` with `STOPSIGNAL SIGTERM`. |
| **Runtime Least Privilege & Limits** | `compose.prod.yaml` lacked `no-new-privileges:true`, `cap_drop: [ALL]`, `read_only` on stateless realtime, and CPU/memory `deploy.resources.limits`. | Medium | Applied `security_opt`, `cap_drop`, `read_only` + `tmpfs` (realtime), and explicit resource caps in `compose.prod.yaml`. |
| **CI Image & Nginx Verification** | CI did not build production Docker images, run `nginx -t`, or run Trivy image scans. | Medium | Added `containers` job in `.github/workflows/ci.yml` and immutable digest build gate in `.github/workflows/deploy-production.yml`. |

## 2. Preserved Working Components

- Local development workflow (`docker compose -f compose.yaml -f compose.dev.yaml up -d`) remains 100% functional with bind mounts, Mailpit (`--profile mail`), and localhost ports.
- Persistent named volumes (`toothcare_mysql_data`, `toothcare_prometheus_data`, `grafana-data`, plus new `toothcare_backend_storage`) are preserved across upgrades.
- Existing 3-network segmentation (`toothcare_edge`, `toothcare_app`, `toothcare_monitoring`) is preserved.
