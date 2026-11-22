# Phase 19 — Metrics Inventory & Cardinality Governance

**Privacy & Cardinality Rule:** Never include patient IDs, user IDs, email addresses, appointment IDs, session tokens, or clinical notes as Prometheus metric labels or values. All labels below are strictly bounded enums.

| Metric Name | Type | Source (`job`) | Interval | Scope | Meaning & Operational Use | Dashboard Panel |
|---|---|---|---|---|---|---|
| `up` | Gauge | All jobs | 15s | Infra | Target scrape reachability (`1` = up, `0` = down) | App Overview: Target Health |
| `nginx_up` | Gauge | `nginx-exporter` | 15s | Infra | Nginx `stub_status` reachability | Infra: Availability |
| `nginx_http_requests_total` | Counter | `nginx-exporter` | 15s | Web | Cumulative HTTP requests handled by Nginx | App Overview: HTTP Request Rate |
| `nginx_connections_active` / `reading` / `writing` / `waiting` | Gauge | `nginx-exporter` | 15s | Web | Active client connections by state | Infra: Nginx Connections |
| `mysql_up` | Gauge | `mysqld-exporter` | 15s | DB | MySQL reachability via least-privilege exporter | Infra: Availability |
| `mysql_global_status_threads_connected` / `threads_running` | Gauge | `mysqld-exporter` | 15s | DB | Active DB connections vs `max_connections` | Infra: MySQL Connections |
| `mysql_global_status_queries` / `slow_queries` | Counter | `mysqld-exporter` | 15s | DB | Query throughput and slow query rate | Infra: MySQL Query Rate |
| `toothcare_email_jobs_pending` | Gauge | `toothcare-api` | 15s | App | Pending + retryable jobs waiting in `email_outbox` | App Overview: Email Outbox Queue |
| `toothcare_email_worker_processing` | Gauge | `toothcare-api` | 15s | App | Jobs currently locked by `email-worker` | App Overview: Email Outbox Queue |
| `toothcare_email_jobs_exhausted` | Gauge | `toothcare-api` | 15s | App | Permanently failed jobs that exhausted retries | App Overview: Email Outbox Queue |
| `toothcare_email_oldest_pending_age_seconds` | Gauge | `toothcare-api` | 15s | App | Age in seconds of the oldest waiting email job | App Overview: Oldest Pending Age |
| `toothcare_email_delivery_success_total{event_type}` | Counter | `toothcare-api` | 15s | App | Delivered emails by bounded `event_type` | App Overview: Deliveries & Failures |
| `toothcare_email_delivery_failure_total{event_type,category}` | Counter | `toothcare-api` | 15s | App | Failed emails by bounded `event_type` & `category` | App Overview: Deliveries & Failures |
| `toothcare_email_retry_total{event_type}` | Counter | `toothcare-api` | 15s | App | Delivery retries performed | App Overview: Deliveries & Failures |
| `toothcare_realtime_outbox_pending` / `processing` / `published_total` / `failed_total` / `retries_total` | Gauge/Counter | `toothcare-api` | 15s | App | Outbox delivery health for real-time events | App Overview: Realtime Events |
| `toothcare_realtime_active_connections` | Gauge | `toothcare-realtime` | 15s | App | Currently connected authenticated Socket.IO clients | App Overview: Active Socket.IO |
| `toothcare_realtime_auth_failures_total` / `rejected_tickets_total` | Counter | `toothcare-realtime` | 15s | App | Handshake auth & ticket failures | App Overview: Realtime Events |
| `toothcare_realtime_events_delivered_by_type_total{event_type}` | Counter | `toothcare-realtime` | 15s | App | Delivered events by allowlisted event type | App Overview: Realtime Events |
| `toothcare_realtime_events_rejected_total` | Counter | `toothcare-realtime` | 15s | App | Internal publisher rejections | App Overview: Realtime Events |
| `container_cpu_usage_seconds_total{name}` | Counter | `cadvisor` | 15s | Infra | Per-container CPU usage | Infra: Container CPU |
| `container_memory_working_set_bytes{name}` | Gauge | `cadvisor` | 15s | Infra | Per-container working set memory | Infra: Container Memory |
