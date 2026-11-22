# Phase 21 — Staging Infrastructure & CI/CD Audit

## 1. Phase 20 Prerequisites Verified

- Multi-stage Dockerfiles (`docker/nginx/Dockerfile`, `docker/php/Dockerfile`, `realtime/Dockerfile`) use locked installs (`npm ci`, `composer install --no-dev`) and exclude dev tooling.
- `compose.yaml` + `compose.prod.yaml` strictly isolate production: only ports `80`/`443` public, zero host source bind mounts, non-root workers (`www-data`, `node`), `no-new-privileges`, `cap_drop: [ALL]`, and resource limits.
- Frontend uses same-origin relative URLs (`/api/v1` in `frontend/src/lib/apiClient.js` and `/socket.io/` in `frontend/src/services/realtime/socket-client.js`), enabling true **build-once, promote-identical-artifact** promotion from Staging to Production without environment-specific Vite rebuilds.

## 2. Gaps Closed in Phase 21

| Gap | Risk | Phase 21 Deliverable |
|---|---|---|
| Empty deployment scripts (`deploy.sh`, `health-check.sh`, `rollback.sh` were 0 bytes) | No repeatable automated deploy/smoke/rollback mechanism | Implemented full Bash scripts in `deployment/scripts/` + CI `bash -n` syntax gate |
| No isolated staging Compose overlay or `.env.staging.example` | Risk of sharing dev/prod volumes, DBs, or sending real SMTP mail from staging | Added `compose.staging.yaml` (dedicated `toothcare_staging_*` volumes + Mailpit test sink) & `.env.staging.example` |
| No staging release/registry pipeline (`deploy-staging.yml`) | No automated build-once GHCR publishing, digest manifest, or staging deploy | Added `.github/workflows/deploy-staging.yml` & upgraded `deploy-production.yml` to promote exact staging-tested tags without rebuilding |
| Hosting credentials / live remote VPS not provisioned in repository | Live remote staging cutover cannot execute from local CLI | Evaluated hosting options honestly in `hosting-target-evaluation.md` and made SSH deploy steps gate cleanly on GitHub Environment secrets |
