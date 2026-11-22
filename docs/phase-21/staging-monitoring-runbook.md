# Staging Monitoring Runbook

Staging monitoring is completely isolated from production (`toothcare_staging_prometheus_data`, `toothcare_staging_grafana_data`, `PROMETHEUS_RETENTION=7d`, separate `GRAFANA_ADMIN_PASSWORD`).

## Starting & Accessing Staging Monitoring

```bash
docker compose --profile monitoring --profile monitoring-linux \
  -f compose.yaml -f compose.prod.yaml -f compose.staging.yaml up -d --no-build

# Access securely over SSH tunnel (never expose 9090/3001/8025 publicly):
ssh -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 -L 8025:127.0.0.1:8025 user@staging-host
```

- **Grafana:** `http://127.0.0.1:3001` (staging admin credentials; anonymous disabled)
- **Prometheus:** `http://127.0.0.1:9090/targets` & `/alerts`
- **Mailpit Captured Emails:** `http://127.0.0.1:8025`
- **Alert Isolation:** Staging uses Option A (Prometheus/Grafana UI visibility only) so staging tests never page production operators.
