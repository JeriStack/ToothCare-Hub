# Phase 14 — Docker, Nginx, HTTPS/WSS, and Monitoring Deployment

## Docker Compose Services

`compose.yaml` includes:
- `realtime`: Multi-stage Node.js 24 Alpine container (`realtime/Dockerfile`) running compiled `dist/src/server.js` as unprivileged user `node`, listening on internal port `4000` on the private `app` network.
- `realtime-worker`: Reuses `toothcare-php-fpm:latest` running `php bin/realtime-worker.php`, with `SIGTERM` graceful shutdown and `--status` healthcheck.

### Commands

```bash
# Validate Compose files
docker compose -f compose.yaml -f compose.dev.yaml config -q
docker compose -f compose.yaml -f compose.prod.yaml config -q

# Start development stack
docker compose -f compose.yaml -f compose.dev.yaml up -d --build

# Start production stack (HTTPS/WSS on 443)
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

## Nginx Reverse Proxy & Internal Isolation

In `nginx/conf.d/toothcare.conf`:
- Public port `80` (and `443` with TLS in production) proxies `/socket.io/` to `http://realtime:4000` with `proxy_http_version 1.1`, `Upgrade $http_upgrade`, `Connection "upgrade"`, `proxy_buffering off`, and `86400s` read/send timeouts.
- Public port `80`/`443` explicitly denies `/api/v1/internal/` (`403 Forbidden`).
- An internal-only `server { listen 8081; }` block (never published in `ports:`) forwards `/api/v1/internal/` to `php-fpm:9000` so `realtime` validates tickets at `http://nginx:8081/api/v1/internal/realtime/tickets/verify`.

## Production HTTPS / WSS Checklist

1. Terminate TLS on Nginx (`443`), forcing `wss://` automatically for same-origin Socket.IO clients.
2. Set `NODE_ENV=production` and a 32+ character `REALTIME_INTERNAL_SECRET` via secrets management.
3. Restrict `ALLOWED_ORIGINS` to explicit production origins (never `*`).
4. Do not publish `realtime` port `4000` or Nginx internal port `8081` to the public internet.

## Monitoring (Prometheus & Grafana)

- `monitoring/prometheus/prometheus.yml` scrapes `realtime:4000/metrics` (`toothcare-realtime`) and `nginx:80/api/v1/metrics` (`toothcare-api`).
- `monitoring/prometheus/rules/toothcare-alerts.yml` defines `RealtimeUnavailable`, `RealtimeOutboxBacklogGrowing`, `RealtimeOutboxPermanentFailures`, and `RealtimeHighAuthFailures`.
- All metrics use bounded low-cardinality labels without PII.
