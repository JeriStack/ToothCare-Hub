# ToothCare Hub — Observability & Incident Investigation Runbook

## 1. Monitoring Access

| Interface | Local Dev URL | Authentication | Staging / Production Access |
|---|---|---|---|
| **Grafana** | `http://127.0.0.1:3001` | `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` (anonymous disabled) | VPN or authenticated admin reverse proxy only |
| **Prometheus** | `http://127.0.0.1:9090` | Loopback-only in dev | Internal network / VPN only (never public internet) |

---

## 2. Quick Operational Commands

```bash
# Start full stack with monitoring profile
docker compose --profile monitoring -f compose.yaml -f compose.dev.yaml up -d

# Inspect container health & uptime
docker compose ps

# Inspect recent logs for a specific service
docker compose logs --tail=100 php-fpm
docker compose logs --tail=100 email-worker
docker compose logs --tail=100 realtime
docker compose logs --tail=100 mysql
docker compose logs --tail=100 prometheus

# Inspect live container CPU/memory usage
docker stats --no-stream

# Safely restart a noncritical worker or exporter
docker compose restart nginx-exporter
docker compose restart email-worker
```

---

## 3. Prometheus & Grafana Inspection

- **Check Scrape Health:** Open `http://127.0.0.1:9090/targets` — verify `prometheus`, `toothcare-api`, `toothcare-realtime`, `nginx-exporter`, `mysqld-exporter`, and `cadvisor` are `UP`.
- **Check Active Alerts:** Open `http://127.0.0.1:9090/alerts`.
- **Grafana Dashboards:** Under folder **ToothCare Hub**, open **ToothCare Hub — Application Overview** (`toothcare-app-overview`) and **ToothCare Hub — Infrastructure Overview** (`toothcare-infra-overview`).
- **Missing Metrics vs Zero:** Panels display `NO DATA` when a scrape target is unreachable and `0` when the service is healthy with zero backlog/activity.

---

## 4. First-Response Investigation Playbooks

| Alert / Symptom | First Checks | Safe Mitigation |
|---|---|---|
| `TargetDown` / `NginxDown` | `docker compose ps`, `docker compose logs --tail=100 nginx` | Verify Nginx config syntax and container health; restart if crashed. |
| `MysqlDown` / `MysqlHighConnectionUsage` | `docker compose logs --tail=100 mysql`, check disk space, verify `toothcare_exporter` grants (`monitoring/mysql/exporter-user.sql`) | Never delete `toothcare_mysql_data`; check slow queries or PHP-FPM pool sizing. |
| `EmailBacklogGrowing` / `EmailOldestPendingTooOld` / `EmailJobsExhausted` | `docker compose logs --tail=100 email-worker`, check Admin > System Health > Email Delivery | Verify SMTP host/credentials; retry eligible jobs after SMTP recovery. Core bookings remain committed. |
| `RealtimeServiceUnavailable` / `RealtimeHighAuthFailures` | `docker compose logs --tail=100 realtime realtime-worker` | Verify `REALTIME_INTERNAL_SECRET` matches between `php-fpm`, `realtime-worker`, and `realtime`. Notifications remain accessible via REST. |
| `ContainerHighMemoryUsage` / `ContainerHighCpuUsage` | `docker stats --no-stream`, inspect container logs | Identify runaway query/worker loop; scale or adjust memory limits. |

---

## 5. Operational Ownership (Pending Institutional Assignment)

- **Alert Reviewer / Primary On-Call:** *Pending assignment by clinic/project leadership.*
- **Deployment & Monitoring Maintainer:** *Pending assignment by clinic/project leadership.*
- **Prometheus Retention:** Default `15d` (`PROMETHEUS_RETENTION` env var); adjust based on host disk capacity.
