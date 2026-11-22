# Phase 19 — Alerting Policy & Delivery Strategy

## 1. Alert Delivery Strategy (Option A — Grafana & Prometheus UI Visibility)

ToothCare Hub adopts **Option A (Prometheus + Grafana Alert Visibility)** for local development and initial staging:
- Alerts are evaluated continuously by Prometheus using `monitoring/prometheus/rules/toothcare-alerts.yml` and surfaced in the authenticated Grafana UI.
- External Alertmanager / email / Slack contact points are intentionally deferred until the clinic designates an approved alert recipient and on-call escalation policy. *(No invented contact emails or webhook URLs are configured.)*

---

## 2. Configured Alert Rules Summary

| Alert Name | Severity | `for` | Trigger Condition |
|---|---|---|---|
| `TargetDown` | critical | `1m` | `up == 0` |
| `MysqlDown` | critical | `1m` | `mysql_up == 0` |
| `NginxDown` | critical | `1m` | `nginx_up == 0` |
| `RealtimeServiceUnavailable` | warning | `1m` | `up{job="toothcare-realtime"} == 0` |
| `MysqlHighConnectionUsage` | warning | `5m` | `threads_connected / max_connections > 0.80` |
| `ContainerHighMemoryUsage` | warning | `5m` | `working_set_bytes / limit_bytes > 0.85` |
| `ContainerHighCpuUsage` | warning | `10m` | `rate(cpu_usage[5m]) > 0.85` |
| `EmailJobsExhausted` | warning | `5m` | `toothcare_email_jobs_exhausted > 0` |
| `EmailBacklogGrowing` | warning | `15m` | `toothcare_email_jobs_pending > 50` |
| `EmailOldestPendingTooOld` | warning | `5m` | `toothcare_email_oldest_pending_age_seconds > 900` |
| `EmailDeliveryStalled` | critical | `10m` | Pending jobs > 0 and > 1h since last sent email |
| `RealtimeOutboxBacklogGrowing` | warning | `5m` | `toothcare_realtime_outbox_pending > 50` |
| `RealtimeOutboxPermanentFailures` | warning | `5m` | `toothcare_realtime_outbox_failed_total > 0` |
| `RealtimeHighAuthFailures` | warning | `5m` | `rate(toothcare_realtime_auth_failures_total[5m]) > 1` |
| `RealtimePublisherRejections` | warning | `5m` | `rate(toothcare_realtime_events_rejected_total[5m]) > 0.2` |

**Baseline Tuning Note:** All numeric thresholds above are initial development/staging baselines and must be tuned after observing real staging traffic.
