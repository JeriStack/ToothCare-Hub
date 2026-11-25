# Testing Guide — Unified Real-Time Notifications & Dashboard Sync

## 1. Backend PHPUnit Suites

```bash
php backend/vendor/bin/phpunit --configuration backend/phpunit.xml \
  backend/tests/Integration/UnifiedNotificationSystemTest.php \
  backend/tests/Integration/NotificationApiTest.php \
  backend/tests/Integration/RealtimeNotificationsTest.php \
  backend/tests/Unit/NotificationServiceTest.php
```

Covers all 4 roles (`ADMIN`, `RECEPTIONIST`, `DENTIST`, `PATIENT`), appointment lifecycle events, role-scoped `schedule.updated` / `service.updated` / `account.created` boundaries, v1.0 contract validation, cursor sync (`after_id`), IDOR protection (`403`), duplicate `eventId` idempotency, and Socket.IO outage retry recovery.

## 2. Node.js + Socket.IO Tests

```bash
npm --prefix realtime test
```

Compiles TypeScript (`tsc -p tsconfig.json`) and runs `realtime/tests/realtime.test.ts` validating `RoomManager` per-role room isolation, v1.0 event allowlist & PII/clinical/credential rejection, single-use/expired/revoked ticket handshakes, HMAC replay protection, duplicate suppression, client event blocking, and CORS rules.

## 3. Frontend Vitest Suites

```bash
npm --prefix frontend test -- --run src/tests/realtime/ src/tests/patient/ src/tests/receptionist/ src/tests/dentist/ src/tests/app/
npm --prefix frontend run build
```

Covers `RealtimeProvider`, `RealtimeSocketClient`, `useDashboardSync` role filtering & debounced batching, `NotificationToastContainer` deduplication & dismissal, `NotificationCenter` bell/badge/mark-read actions, and reconnect recovery.
