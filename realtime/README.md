# ToothCare Hub — Real-Time Notification Service

Dedicated Node.js + TypeScript + Socket.IO microservice responsible strictly for authenticated real-time event delivery.

MySQL and the native PHP REST API remain the sole authoritative sources of truth for appointments, permissions, and persistent notifications.

## Commands

```bash
npm install        # Install dependencies
npm run typecheck  # TypeScript strict type checking
npm run build      # Compile TypeScript to dist/
npm run dev        # Watch-mode TypeScript compilation
npm run start      # Start compiled production server (dist/src/server.js)
npm run test       # Build and run Node.js unit + Socket.IO integration tests
```

## Endpoints (Internal / Edge)

- `GET /health` — Service readiness and active connection count.
- `GET /metrics` — Prometheus metrics (internal Docker network only; no PII labels).
- `POST /internal/publish` — HMAC-SHA256 signed PHP-to-Node event publishing endpoint (internal network only).
- `POST /internal/revoke` — HMAC-SHA256 signed PHP-to-Node session/user/role revocation endpoint (internal network only).
- `/socket.io/` — Authenticated Socket.IO WebSocket/polling endpoint (proxied through Nginx).

## Environment Variables

Copy `.env.example` to `.env` for local development. In production (`NODE_ENV=production`), `REALTIME_INTERNAL_SECRET` must be at least 32 characters and `ALLOWED_ORIGINS` must list explicit origins without `*`.
