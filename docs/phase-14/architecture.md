# Phase 14 — Real-Time Notifications Architecture

## Core Architectural Principle

**MySQL and the native PHP REST API remain the sole authoritative sources of truth.**

The Node.js + Socket.IO service (`realtime/`) is responsible strictly for authenticated real-time event fan-out. It never modifies appointment records, never writes business state to MySQL, never trusts client-supplied identities or room names, and is never a mandatory dependency for appointment operations.

```text
React Frontend
      │  Authenticated REST API (HttpOnly session + CSRF)
      ▼
PHP Backend API (Native PHP 8.5, /api/v1)
      │  Auth, DRBAC, appointment business logic, MySQL transactions
      ▼
MySQL 8.0 Database
      │  Atomic commit: appointments + status_history + notifications + realtime_outbox
      ▼
PHP Outbox Publisher / Worker (bin/realtime-worker.php + post-commit best-effort)
      │  HMAC-SHA256 signed POST /internal/publish (Docker internal network)
      ▼
Node.js + TypeScript Socket.IO Service (realtime:4000)
      │  Signed ticket verification -> server-controlled rooms -> targeted delivery
      ▼
React Notification Client (RealtimeProvider + useNotifications)
      │  Deduplicated live updates + REST recovery on reconnect
      ▼
PHP Notification REST API (/api/v1/notifications)
```

## Component Responsibilities

| Component | Authoritative Ownership |
|---|---|
| **PHP API** | Session auth, DRBAC permissions, appointment transactions, persistent `notifications` rows, transactional `realtime_outbox` enqueue, short-lived `realtime_tickets` issuance/verification, session/role revocation triggers |
| **MySQL 8.0** | `appointments`, `notifications`, `realtime_tickets` (SHA-256 hashes only), `realtime_outbox` (retry/idempotency state) |
| **PHP Realtime Worker** | Polls `realtime_outbox` with stale-lock recovery and exponential backoff, delivers signed envelopes to `realtime:4000/internal/publish` |
| **Node.js Socket.IO** | Verifies tickets via internal Nginx port `8081` (`POST /api/v1/internal/realtime/tickets/verify`), assigns server-controlled rooms, enforces default-deny client event guard, delivers validated events, executes revocations |
| **React Frontend** | Acquires ephemeral single-use tickets in memory, manages Socket.IO lifecycle, deduplicates `eventId`, reconciles with PHP REST API on event/reconnect/tab focus |

## Outage Resilience

If the `realtime` container is stopped or unreachable:
- Appointment booking, confirmation, rejection, cancellation, completion, and rescheduling **continue to succeed** normally.
- Persistent `notifications` rows and `realtime_outbox` rows commit atomically with the appointment transaction.
- `realtime-worker` retries failed outbox events with exponential backoff (`5s`, `15s`, `60s`, `300s`, `900s`) up to `REALTIME_WORKER_MAX_ATTEMPTS`.
- React falls back to periodic REST polling (`useNotifications`) and automatically reconciles once Socket.IO reconnects.
