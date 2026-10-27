# Grafana Provisioning & Dashboards

- **`provisioning/datasources/prometheus.yml`**: Automatically provisions Prometheus datasource (`http://prometheus:9090`).
- **`provisioning/dashboards/dashboards.yml`**: Auto-loads version-controlled JSON dashboards from `/var/lib/grafana/dashboards`.
- **`dashboards/toothcare-overview.json`**: Application metrics dashboard (API request rates, error rates, real-time client connections).
- **`dashboards/infrastructure.json`**: Infrastructure resource monitoring (container CPU, memory, restarts, database metrics).
