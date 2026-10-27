# Monitoring and Observability (Prometheus & Grafana)

This directory is part of the approved ToothCare Hub root layout for operational metrics, alerting rules, and dashboard documentation.

## Responsibilities

- **Prometheus Metrics Collection:** Scrapes internal service health, HTTP status classes, latency histograms, and infrastructure exporters on a private monitoring network.
- **Grafana Provisioning & Dashboards:** Automatically provisions the Prometheus datasource (`http://prometheus:9090`) and version-controlled operational dashboards.
- **Privacy & Cardinality Rules:**
  - Never include patient IDs, email addresses, appointment IDs, session tokens, or clinical diagnosis/treatment notes in Prometheus metric labels or dashboard panels.
  - Keep Prometheus (`9090`), Grafana (`3000`), and exporter endpoints restricted to localhost in development or behind authenticated/VPN access in production.

## Active Configuration Files

The active container mount files referenced by `docker-compose.yml` are located at:

- [`docker/prometheus/prometheus.yml`](../docker/prometheus/prometheus.yml)
- [`docker/grafana/provisioning/datasources/datasource.yml`](../docker/grafana/provisioning/datasources/datasource.yml)
- [`docker/grafana/provisioning/dashboards/dashboards.yml`](../docker/grafana/provisioning/dashboards/dashboards.yml)
- [`docker/grafana/dashboards/toothcare-overview.json`](../docker/grafana/dashboards/toothcare-overview.json)

