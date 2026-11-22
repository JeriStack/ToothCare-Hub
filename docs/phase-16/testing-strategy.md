# Phase 16 — Testing Strategy Overview

## Architecture & Layers

ToothCare Hub enforces a layered testing strategy where **MySQL + Native PHP (`/api/v1`)** remain the authoritative system of record and every critical user journey, business rule, security boundary, and contract is automatically verified:

| Layer | Framework / Tool | Scope |
| --- | --- | --- |
| **Backend Unit** | PHPUnit 11 (`composer test:unit`) | Validators, appointment state machine, availability/slot math, retry policies, payload encryption, config/CORS/CSRF middleware |
| **Backend Integration** | PHPUnit 11 (`composer test:integration`) | PDO repositories, transactions, row locking, RBAC/DRBAC, IDOR ownership, dashboards, search, pagination, reports, outbox workers |
| **API Contract** | OpenAPI 3.x validator + `Phase16ApiContractTest` + Postman v2.1 collection | 57 documented paths, `{ data, meta, error }` envelope, status codes (`200/201/400/401/403/404/409/422`), pagination metadata |
| **Real-Time Service** | Node.js `node:test` + TypeScript (`npm --prefix realtime test`) | Room isolation, single-use hashed ticket handshake, HMAC-SHA256 internal publisher, replay protection, client event blocking |
| **Frontend Unit/Component** | Vitest 5 + React Testing Library (`npm --prefix frontend test -- --run`) | Auth forms, booking flows, dashboards, reports, appointment search, notifications, skeletons, Light/Dark themes, responsive contracts |
| **End-to-End Browser** | Playwright (`npm run test:e2e:local`) | Landing page, Light/Dark theme persistence across 9 viewports, login validation, authenticated admin dashboard & operational views |
| **Database Migrations** | MySQL 8.0 CI service + `database/migrate.php` | Clean empty-schema apply (`001`–`032`), schema assertions, and re-run idempotency |
