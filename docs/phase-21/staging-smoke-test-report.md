# Staging Smoke Test Report & Verification Matrix

> **Honest Status:** All local CI/Compose/script/backend/frontend/realtime/OpenAPI checks are **PASSED**. Live remote staging host smoke checks (`deployment/scripts/health-check.sh` against an external VPS URL) are **BLOCKED / NOT VERIFIED** pending VPS hosting provisioning and GitHub `staging` Environment secrets.

| Verification Check | Automated Script / Gate | Local Verification | Live Staging Host |
|---|---|---|---|
| Compose Staging Config (`compose.staging.yaml`) | `docker compose -f compose.yaml -f compose.prod.yaml -f compose.staging.yaml config -q` | **PASSED** | Pending VPS |
| Deploy / Health / Rollback Bash Scripts | `bash -n deployment/scripts/*.sh` | **PASSED** | Pending VPS |
| Workflows (`ci.yml`, `deploy-staging.yml`, `deploy-production.yml`) | YAML parse validation | **PASSED** | Pending GitHub push |
| Edge Health, SPA Fallback, Security `403`s (`/metrics`, `/internal/*`, `/stub_status`) | `deployment/scripts/health-check.sh` | Automated in script | **NOT VERIFIED (No VPS)** |
| Synthetic Login, Booking, Mailpit Email Capture, WSS Realtime & Prometheus Targets | `health-check.sh` + Staging Runbook | Verified locally via PHPUnit/Vitest/Realtime | **NOT VERIFIED (No VPS)** |
