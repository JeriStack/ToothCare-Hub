# Phase 14 — Testing Guide

## 1. PHP Backend Tests (PHPUnit)

```bash
php backend/vendor/bin/phpunit backend/tests/Integration/RealtimeNotificationsTest.php
php backend/vendor/bin/phpunit -c backend/phpunit.xml
```

Covers:
- Ticket issuance, SHA-256 hash-only storage, single-use consumption, expiration, revocation, inactive user rejection
- HMAC-SHA256 internal signature enforcement and nonce replay protection
- Transactional atomicity (notification + `realtime_outbox` committed together; rolled back cleanly on failure)
- Minimal non-clinical payload validation
- Real-time outage resilience and worker retry recovery
- Cross-user notification ownership isolation (`403`)

## 2. Node.js Socket.IO Service Tests

```bash
npm --prefix realtime run typecheck
npm --prefix realtime test
```

Covers:
- Real Socket.IO server/client handshake auth (missing, invalid, query-string, expired, revoked, inactive, single-use replay)
- Server-controlled room calculation across all 4 roles and DRBAC permissions
- Event allowlist and clinical/PII payload rejection
- Signed publishing, nonce replay rejection, duplicate `eventId` idempotency
- Client-emitted `join` / privileged event blocking (`FORBIDDEN_CLIENT_EVENT`)
- Targeted session revocation disconnecting only the revoked session's socket
- `/health` and `/metrics` endpoints

## 3. React Frontend Tests (Vitest)

```bash
npm --prefix frontend test -- --run src/tests/realtime/RealtimeNotifications.test.jsx
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

Covers:
- Ticket acquisition in memory (never in `localStorage`/`sessionStorage`)
- Connection status transitions (`Connecting`, `Live`, `Reconnecting`, `Sync mode`)
- Duplicate `eventId` suppression
- Reconnection with fresh ticket + REST API recovery
- Logout / `toothcare:unauthorized` disconnection and listener cleanup

## 4. CI/CD Pipeline

`.github/workflows/ci.yml` executes:
- `infrastructure`: Docker Compose validation (`compose.yaml`, `compose.dev.yaml`, `compose.prod.yaml`)
- `backend`: Composer validate, PHP lint, PHPUnit (355+ tests), email & realtime worker checks, OpenAPI validation
- `migrations`: Applies all migrations (including `031_create_realtime_tables.sql`) against MySQL 8.0 and verifies `realtime_tickets` & `realtime_outbox`
- `realtime`: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`
- `frontend`: `npm ci`, Vitest suite, production Vite build, responsive contract tests
