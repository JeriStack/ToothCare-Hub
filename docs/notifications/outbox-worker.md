# Transactional Outbox & Worker Operations

## Atomic Persistence

Business services persist domain mutations, `notifications`, and `realtime_outbox` entries inside the same MySQL PDO transaction. If any step fails, the transaction rolls back completely and zero orphaned notifications or events exist. Network publishing to Node.js happens strictly **after** `COMMIT`.

## Concurrency-Safe Claiming (`RealtimeOutboxRepository`)

- On MySQL 8+, `claimDueBatch()` runs a short transaction using `SELECT id ... FOR UPDATE SKIP LOCKED` to claim due `PENDING` / `FAILED_RETRYABLE` rows safely across concurrent workers.
- Duplicate `event_id` insertions are ignored idempotently (`INSERT IGNORE` / `UNIQUE (event_id)`).
- Stale `PROCESSING` locks older than `REALTIME_WORKER_STALE_LOCK_SECONDS` are automatically reclaimed into `FAILED_RETRYABLE`.

## Retry Policy & Delivery Semantics

- **Retryable failures** (network timeout, HTTP 5xx, HTTP 429, Node.js outage): marked `FAILED_RETRYABLE` with exponential backoff (`5s, 15s, 60s, 300s, 900s`) up to `max_attempts` (default `5`).
- **Permanent failures** (HTTP `400`/`422`, corrupt JSON, or exhausted attempts): marked `FAILED_PERMANENT`.
- **Delivery guarantee**: **At-least-once** delivery to Socket.IO. Node.js deduplicates retried `eventId` values in a bounded TTL cache, and React deduplicates `eventId` and `notificationId`. Because a WebSocket emit cannot guarantee every client tab received the packet, persistent MySQL `notifications` and `GET /api/v1/notifications/sync` remain authoritative.

## Worker CLI (`backend/bin/realtime-worker.php`)

```bash
php backend/bin/realtime-worker.php --status   # Print queue counts & validate config
php backend/bin/realtime-worker.php --once     # Process one batch and exit
php backend/bin/realtime-worker.php            # Continuous daemon (SIGTERM/SIGINT graceful shutdown)
```
