# Phase 19 — Monitoring Verification & Controlled Failure Report

## 1. Automated Configuration & Contract Verification (Executed)

| Check | Tool / Test | Status | Evidence |
|---|---|---|---|
| Docker Compose (`dev`, `prod`, `monitoring` profile) | `docker compose --profile monitoring -f compose.yaml -f compose.dev.yaml config -q` | **PASSED** | Exit code `0` |
| Prometheus Config & Alert Rules Syntax | `promtool check config` & `promtool check rules` (and YAML structure test in `Phase19ObservabilityTest`) | **PASSED** | Validated in local test & wired in `.github/workflows/ci.yml` |
| Grafana Datasource & Dashboard JSON Validity | `Phase19ObservabilityTest` + JSON parser | **PASSED** | `toothcare-overview.json` (7 panels) & `infrastructure.json` (6 panels) valid; `uid: prometheus` matched |
| PHP `/api/v1/metrics` Output & Privacy Hygiene | `Phase19ObservabilityTest` | **PASSED** | Emits `toothcare_email_oldest_pending_age_seconds` + outbox gauges/counters; zero PII/secrets |
| Realtime `/metrics` & Security Suite | `npm --prefix realtime test` | **PASSED** | `4/4` tests passing |

---

## 2. Controlled Target Failure & Recovery Drill Procedure

> **Execution Status in Local Sandbox:** **NOT VERIFIED LIVE** (Docker daemon containers are not started automatically inside the local CLI sandbox). Execute the safe procedure below when the monitoring stack is running on local Docker Desktop or staging, and record timestamps:

1. Start stack: `docker compose --profile monitoring -f compose.yaml -f compose.dev.yaml up -d`.
2. Confirm `nginx-exporter` is `UP` on `http://127.0.0.1:9090/targets`.
3. Stop only the noncritical exporter: `docker compose stop nginx-exporter` (core API & MySQL remain completely untouched).
4. Wait ~75 seconds (scrape `15s` + `for: 1m`).
5. Verify `TargetDown{job="nginx-exporter"}` transitions `PENDING` → `FIRING` on `http://127.0.0.1:9090/alerts` and Grafana shows `DOWN` on the Target Health panel.
6. Restore: `docker compose start nginx-exporter`.
7. Confirm target returns to `UP` and alert clears automatically.
