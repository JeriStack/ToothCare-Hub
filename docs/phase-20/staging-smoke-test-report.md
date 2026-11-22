# Staging Smoke Test Report & Checklist

> **Execution Status:** Local CI/contract/build validations executed and **PASSED**; live staging cluster deployment smoke tests are **NOT VERIFIED** in this local CLI environment and must be executed against the promoted immutable image artifacts prior to production cutover.

| Category | Smoke Check | Status |
|---|---|---|
| **Compose & Config** | `docker compose -f compose.yaml -f compose.dev.yaml config -q` & `compose.prod.yaml config -q` | **PASSED** |
| **Application Suites** | PHPUnit (`376` tests), Vitest (`210` tests), Realtime (`4` tests), OpenAPI (`105` paths) | **PASSED** |
| **Frontend Build** | `npm --prefix frontend run build` (`index.js` `299.92 kB` / `64.88 kB` gzip) | **PASSED** |
| **Docker Image Builds & `nginx -t`** | Verified via CI `containers` job (local daemon build: see Phase 20 report) | **PENDING LIVE STAGING** |
| **Live Staging E2E** | SPA deep-link refresh, login, RBAC, booking, email outbox, Socket.IO WSS, Prometheus targets, Grafana dashboards | **NOT VERIFIED (Staging Gate)** |
| **Security Port Scan** | Verify only `80`/`443` public; `3306`, `9000`, `4000`, `9090`, `9104`, `9113`, `8080` private | **NOT VERIFIED (Staging Gate)** |
