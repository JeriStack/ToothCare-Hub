# Reliability and Failure-Scenario Testing

## 1. Verified Automated Failure-Isolation Controls

| Scenario | Verified Behavior | Test Evidence |
|---|---|---|
| **SMTP Failure / Outage** | Appointments commit atomically with `email_outbox` rows; SMTP errors never roll back bookings; exponential retry backoff and `FAILED_PERMANENT` exhaustion handled cleanly without logging secrets. | `EmailOutboxServiceTest`, `EmailWorkerTest`, `Phase16ReliabilityTest` |
| **Real-Time (Socket.IO) Downtime** | Appointment operations and persistent `notifications` table writes succeed via PHP REST API even when Socket.IO is unreachable; `realtime_outbox` retries post-commit; unread notifications recover via `GET /api/v1/notifications`. | `RealtimeOutboxServiceTest`, `Phase16ReliabilityTest`, `realtime` `npm test` (`4/4`) |
| **Database Error Handling** | `ExceptionHandler` catches `PDOException`, logs sanitized diagnostics with `request_id`, and returns `503 SERVICE_UNAVAILABLE` without exposing SQL credentials or stack traces. | `ExceptionHandlerTest`, `Phase16ApiContractTest` |
| **Expired / Revoked Session** | `AuthenticationMiddleware` rejects expired sessions (`401 SESSION_EXPIRED`); account deactivation immediately revokes active Socket.IO tickets and emits best-effort revocation. | `AuthIntegrationTest`, `UserManagementTest`, `Phase16SecurityAuthTest` |
| **Backup Identifier & Encryption Integrity** | AES-256-GCM tamper detection, SHA-256 verification, and identifier injection rejection verified without modifying production data. | `DatabaseBackupTest`, `Phase18HardeningTest` |

---

## 2. Live Infrastructure Failure Drills (Pre-Production Staging Gate)

The following container-level chaos drills require a live Docker Compose staging host and are marked **NOT VERIFIED** in this local test run:
- Killing and restarting `toothcare-php-fpm`, `toothcare-realtime`, `toothcare-email-worker`, and `toothcare-nginx` under live HTTP/WebSocket traffic.
- Full MySQL 8.0 `testRestoreInIsolation()` drill against a populated staging database.
