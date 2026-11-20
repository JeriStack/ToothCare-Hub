# Phase 14 — Troubleshooting Guide

| Symptom | Likely Cause | Resolution |
|---|---|---|
| Socket stays in `Sync mode` / `Reconnecting` | `realtime` container is stopped or `REALTIME_INTERNAL_SECRET` mismatch between PHP and Node.js | Check `GET http://127.0.0.1:4000/health` and confirm identical `REALTIME_INTERNAL_SECRET` in `backend/.env` and `realtime/.env`. |
| `401 TICKET_INVALID` or `AUTH_SERVICE_UNAVAILABLE` during handshake | `BACKEND_INTERNAL_API_URL` unreachable from `realtime` container | Ensure `realtime` reaches internal Nginx listener (`http://nginx:8081`) on the Docker `app` network. |
| `401 TIMESTAMP_OUT_OF_WINDOW` | Clock skew between PHP and Node.js hosts exceeds `REPLAY_WINDOW_SECONDS` (300s) | Sync container/host clocks with NTP. |
| `403` on `/api/v1/internal/realtime/*` | Calling internal endpoint through public Nginx port `80`/`443` | Expected security behavior. Internal calls must use port `8081` on the private Docker network. |
| `realtime_outbox` rows stuck in `FAILED_RETRYABLE` | `realtime` service unreachable or `realtime-worker` stopped | Start `realtime` and check `php backend/bin/realtime-worker.php --status`. |
| CORS error on WebSocket upgrade | Frontend origin missing from `ALLOWED_ORIGINS` | Add the exact origin (e.g. `http://localhost:5173`) to `realtime/.env` `ALLOWED_ORIGINS` (never use `*`). |
| Notifications still work when `realtime` is down | Expected fallback behavior | PHP/MySQL remain authoritative; `useNotifications` continues REST polling and reconciles automatically when `realtime` returns. |
