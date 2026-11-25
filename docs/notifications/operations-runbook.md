# Operations & Monitoring Runbook

## Health Checks

- **Node.js Socket.IO Service**: `GET http://toothcare-realtime:4000/health` (exposed on loopback `127.0.0.1:4000/health`).
- **Outbox Worker Diagnostics**: `docker exec toothcare-realtime-worker php /var/www/backend/bin/realtime-worker.php --status`.

## Prometheus Metrics (Bounded Labels Only — Zero PII)

### Node.js Realtime Service (`http://toothcare-realtime:4000/metrics`)
- `toothcare_realtime_up`, `toothcare_realtime_uptime_seconds`
- `toothcare_realtime_active_connections`, `toothcare_realtime_connections_total`
- `toothcare_realtime_auth_failures_total`, `toothcare_realtime_rejected_tickets_total`
- `toothcare_realtime_events_received_total`, `toothcare_realtime_events_delivered_total`, `toothcare_realtime_events_rejected_total`, `toothcare_realtime_events_duplicate_total`
- `toothcare_realtime_events_delivered_by_type_total{event_type="..."}`
- `toothcare_realtime_event_delivery_duration_ms_sum`, `toothcare_realtime_event_delivery_duration_ms_count`
- `toothcare_realtime_session_revocations_total`, `toothcare_realtime_socket_errors_total`, `toothcare_realtime_unauthorized_client_events_total`

### PHP Backend (`http://toothcare-nginx/api/v1/metrics`)
- `toothcare_realtime_outbox_pending`, `toothcare_realtime_outbox_processing`, `toothcare_realtime_outbox_published_total`, `toothcare_realtime_outbox_failed_total`, `toothcare_realtime_outbox_retries_total`
- `toothcare_notifications_created_total{event_type="..."}`, `toothcare_notifications_unread_total`

## Common Recovery Procedures

1. **Outbox Backlog Growing (`toothcare_realtime_outbox_pending > 0`)**:
   - Check `docker ps` for `toothcare-realtime` and `toothcare-realtime-worker`.
   - Inspect worker logs (`docker logs --tail 50 toothcare-realtime-worker`) and restart containers after backend/realtime code updates (`docker restart toothcare-php-fpm toothcare-realtime-worker toothcare-realtime`).
2. **Socket.IO Clients Stuck in `Sync mode` / `Reconnecting`**:
   - Verify Nginx `/socket.io/` WebSocket upgrade proxy headers and `REALTIME_INTERNAL_SECRET` parity between PHP and Node.js.
   - Verify users still receive all notifications via REST fallback (`GET /api/v1/notifications` & `GET /api/v1/notifications/sync`).
