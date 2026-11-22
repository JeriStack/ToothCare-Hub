# Monitoring and Observability (Prometheus & Grafana)

This directory is part of the approved ToothCare Hub root layout for operational metrics, alerting rules, and dashboard documentation.

## Responsibilities

- **Prometheus Metrics Collection:** Scrapes internal service health, HTTP status classes, latency histograms, and infrastructure exporters on a private monitoring network.
- **Grafana Provisioning & Dashboards:** Automatically provisions the Prometheus datasource (`http://prometheus:9090`) and version-controlled operational dashboards.
- **Privacy & Cardinality Rules:**
  - Never include patient IDs, email addresses, appointment IDs, session tokens, or clinical diagnosis/treatment notes in Prometheus metric labels or dashboard panels.
  - Keep Prometheus (`9090`), Grafana (`3000`), and exporter endpoints restricted to localhost in development or behind authenticated/VPN access in production.

## Active Configuration Files

The active container mount files referenced by `compose.yaml` (`--profile monitoring`) are located at:

- [`monitoring/prometheus/prometheus.yml`](prometheus/prometheus.yml)
- [`monitoring/prometheus/rules/toothcare-alerts.yml`](prometheus/rules/toothcare-alerts.yml)
- [`monitoring/grafana/provisioning/datasources/prometheus.yml`](grafana/provisioning/datasources/prometheus.yml)
- [`monitoring/grafana/provisioning/dashboards/dashboards.yml`](grafana/provisioning/dashboards/dashboards.yml)
- [`monitoring/grafana/dashboards/toothcare-overview.json`](grafana/dashboards/toothcare-overview.json)
- [`monitoring/grafana/dashboards/infrastructure.json`](grafana/dashboards/infrastructure.json)
- [`monitoring/mysql/exporter-user.sql`](mysql/exporter-user.sql)

Full Phase 19 documentation, runbook, and verification guides live in [`docs/phase-19/`](../docs/phase-19/monitoring-architecture.md).

