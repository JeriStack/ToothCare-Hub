# Docker Monitoring Setup Guide (Local vs. Staging/Production)

## 1. Starting Monitoring Locally (Windows / macOS / Linux)

```bash
# 1. Start core stack + monitoring profile (Prometheus, Grafana, MySQL/Nginx exporters, cAdvisor)
docker compose --profile monitoring -f compose.yaml -f compose.dev.yaml up -d

# 2. Provision the least-privilege MySQL exporter account (one-time per database volume)
#    Edit password in monitoring/mysql/exporter-user.sql or run directly via mysql client,
#    then set MYSQL_EXPORTER_USER and MYSQL_EXPORTER_PASSWORD in your local .env.
```

## 2. Linux Staging / Production (Including Host `node-exporter`)

```bash
docker compose --profile monitoring --profile monitoring-linux \
  -f compose.yaml -f compose.prod.yaml up -d
```

## 3. Configuration Differences: Local vs. Production

| Setting | Local Development (`compose.dev.yaml`) | Staging / Production (`compose.prod.yaml`) |
|---|---|---|
| Grafana / Prometheus Ports | Bound to `127.0.0.1` (`3001`, `9090`) | Restricted to VPN / private admin network only |
| Grafana Admin Password | Local `.env` override | Strong secret from deployment secret manager |
| MySQL Exporter Account | `toothcare_exporter` (least privilege) | Dedicated `toothcare_exporter` with `MAX_USER_CONNECTIONS 3` |
| Host Metrics (`node-exporter`) | Omitted on Windows Docker Desktop | Enabled via `--profile monitoring-linux` |
| Prometheus Retention | `15d` default (`PROMETHEUS_RETENTION`) | Tuned to available persistent volume capacity (e.g., `30d`) |
