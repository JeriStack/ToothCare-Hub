# Phase 19 — Monitoring & Observability Architecture

**Core Principle:** Prometheus collects operational metrics, Grafana visualizes them, and ToothCare Hub's core clinic workflows (booking, authentication, notifications, treatment records) have **zero runtime dependency** on Prometheus or Grafana.

---

## 1. Architecture Topology

```text
                       ┌──────────────────────────────────────┐
                       │   Localhost / VPN / Admin Auth Only   │
                       │  Grafana :3001   |  Prometheus :9090 │
                       └─────────┬────────┴─────────┬─────────┘
                                 │ monitoring net   │
                          ┌──────▼──────┐    ┌──────▼──────────┐
                          │   Grafana   │───▶│   Prometheus    │
                          │   (11.1.0)  │    │    (v2.53.1)    │
                          └─────────────┘    │  retention=15d  │
                                             └──┬──┬──┬──┬──┬──┘
               ┌────────────────────────────────┘  │  │  │  └────────────────────────┐
               ▼                                   ▼  │  ▼                           ▼
     ┌──────────────────┐          ┌────────────────┐ │ ┌─────────────────┐   ┌───────────────┐
     │   nginx:8081     │          │ realtime:4000  │ │ │ nginx-exporter  │   │  cadvisor     │
     │ /api/v1/metrics  │          │   /metrics     │ │ │ :9113 (internal)│   │ :8080         │
     │ (PHP-FPM outbox) │          │ (Socket.IO)    │ │ │ <- /stub_status │   │ (containers)  │
     └──────────────────┘          └────────────────┘ │ └─────────────────┘   └───────────────┘
                                                      ▼
                                            ┌───────────────────┐
                                            │ mysqld-exporter   │
                                            │ :9104 (least-priv)│
                                            │ <- mysql:3306     │
                                            └───────────────────┘
```

---

## 2. Network & Security Boundaries

- **Public Edge (`toothcare_edge`, port `80`/`443`):** Serves React SPA, `/api/v1/*`, and `/socket.io/`. Explicitly blocks `/api/v1/internal/*` (`403`), `/api/v1/metrics` (`403`), and `/stub_status` (not registered on port `80`).
- **Internal App Network (`toothcare_app`):** Hosts `php-fpm`, `mysql`, `realtime`, workers, and internal Nginx listener port `8081` (never published to host).
- **Monitoring Network (`toothcare_monitoring`):** Isolates `prometheus`, `grafana`, `mysqld-exporter`, `nginx-exporter`, `cadvisor`, and optional Linux `node-exporter`.
- **Admin UI Binding:** `prometheus` (`127.0.0.1:9090`) and `grafana` (`127.0.0.1:3001`) bind strictly to loopback in local dev, with `GF_AUTH_ANONYMOUS_ENABLED=false` and `GF_USERS_ALLOW_SIGN_UP=false`.
- **Persistence & Retention:** `prometheus-data` (`toothcare_prometheus_data`) retains `15d` by default (`--storage.tsdb.retention.time=${PROMETHEUS_RETENTION:-15d}`). `grafana-data` persists Grafana state alongside Git-provisioned datasources and dashboards.
