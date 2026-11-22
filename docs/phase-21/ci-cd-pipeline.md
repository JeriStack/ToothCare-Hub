# Phase 21 — CI/CD Pipeline & Artifact Promotion Architecture

## 1. Workflows Overview

| Workflow | Trigger | Purpose |
|---|---|---|
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Push / PR to `main`, `develop`, `development` | Compose validation (dev/prod/staging/monitoring), `bash -n` deploy scripts, `promtool` & Grafana JSON checks, Composer/npm audits, PHP lint & PHPUnit (`unit` + `integration`), OpenAPI drift & route-coverage checks, MySQL 8 migration idempotency, Realtime typecheck/build/tests, Frontend Vitest/build/responsive contracts, multi-stage Docker builds, `nginx -t`, and Trivy `CRITICAL` image scans. |
| [`.github/workflows/deploy-staging.yml`](../../.github/workflows/deploy-staging.yml) | Push to `staging`/`develop`, tags `v*`, or `workflow_dispatch` | Builds immutable `toothcare-frontend`, `toothcare-backend`, `toothcare-realtime` images once (`sha-<12>` or `vX.Y.Z`), verifies `nginx -t` + Trivy, pushes to GHCR, uploads `release-manifest.json` with SHA-256 digests, and deploys to `staging` via `deploy.sh`. |
| [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml) | `release: published` or `workflow_dispatch` (`image_tag` required) | Protected `production` environment gate; **never rebuilds images** — promotes the exact staging-verified GHCR tag via `deploy.sh` (with mandatory pre-migration backup + health checks). |

## 2. Build-Once Frontend Strategy

Because `frontend/src/lib/apiClient.js` defaults to `/api/v1` and `frontend/src/services/realtime/socket-client.js` defaults to same-origin `/socket.io/` (proxied by Nginx), **one immutable `toothcare-frontend:<tag>` image works across Staging and Production** without rebuilding Vite assets per environment.
