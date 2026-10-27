# ToothCare Hub - Observability Runbook

## Overview
This runbook guides monitoring, metrics inspection, dashboard operations, and alert response for ToothCare Hub across Docker Compose and production environments.

## Architecture & Data Flow
1. **Prometheus:** Scrapes internal service metrics on the private Docker monitoring network every 15 seconds.
2. **Grafana:** Auto-provisions the Prometheus datasource (`http://prometheus:9090`) and version-controlled dashboards.
3. **Alerts:** Evaluated periodically in Prometheus (`monitoring/prometheus/rules/toothcare-alerts.yml`).

## Recommended Scrape Targets & Health
| Target | Endpoint | Typical Port | Purpose |
|---|---|---|---|
| Prometheus | `/metrics` | 9090 | Self-monitoring |
| PHP Backend | `/api/v1/metrics` | 9000 (FastCGI/internal) | Request counts, status classes, latency |
| Socket.IO | `/metrics` | 4000 (internal) | Active connections, event counters |
| Nginx | `/stub_status` | 80 (restricted internal) | Connections, handled requests |

## Initial Alert Response Procedures

### 1. `TargetDown`
- **Symptom:** A monitored service container cannot be reached by Prometheus.
- **Action:** Check container health via `docker compose ps`. Inspect logs via `docker compose logs -f <service>`. Verify network connectivity.

### 2. `ApiHigh5xxRate`
- **Symptom:** Over 5% of API requests returning 5xx responses.
- **Action:** Inspect `backend/storage/logs/` and Nginx error logs. Check database availability and PDO connection timeouts.

### 3. `ApiHighLatency`
- **Symptom:** 95th percentile latency exceeds 1.5 seconds.
- **Action:** Inspect slow queries in MySQL. Check server CPU/memory contention via `infrastructure.json` dashboard.

### 4. `RealtimeUnavailable`
- **Symptom:** Socket.IO service is unreachable.
- **Action:** Check `realtime` container logs. Ensure clients degrade gracefully to REST notification polling (`GET /api/v1/notifications`).

## Privacy & Security Guidelines
- **Cardinality & Data Minimization:** Never include patient names, patient IDs, email addresses, diagnosis notes, or session secrets in Prometheus metric labels or Grafana panels.
- **Access Restrictions:** Prometheus and Grafana admin UIs must never be exposed publicly. Bind only to `127.0.0.1` locally, and place behind VPN or authenticated ingress in production.
