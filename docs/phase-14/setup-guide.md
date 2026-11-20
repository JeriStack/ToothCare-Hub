# Phase 14 — Local Development Setup Guide

## Prerequisites

- PHP 8.5+ with Composer (`pdo`, `pdo_mysql`, `pdo_sqlite`)
- Node.js 24+ and npm
- MySQL 8.0+ (or Docker Compose stack)

## 1. Apply Database Migration

```bash
php database/migrate.php
```

This applies `database/migrations/031_create_realtime_tables.sql` (`notifications.role` ENUM update, `realtime_tickets`, `realtime_outbox`).

## 2. Configure Shared Internal Secret

Generate a 32-byte hex secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the exact same `REALTIME_INTERNAL_SECRET` value in:
- `backend/.env`
- `realtime/.env`
- (or root `.env` when using Docker Compose)

## 3. Start the Real-Time Service (`realtime/`)

```bash
cd realtime
npm install
npm run build
npm run start
```

Verify readiness:

```bash
curl http://127.0.0.1:4000/health
```

## 4. Start the Real-Time Outbox Worker (`backend/`)

```bash
php backend/bin/realtime-worker.php
```

Check worker status without processing:

```bash
php backend/bin/realtime-worker.php --status
```

## 5. Start the Frontend (`frontend/`)

`frontend/vite.config.js` already proxies `/api` and `/socket.io` (`ws: true`) to `http://127.0.0.1:8080`:

```bash
cd frontend
npm run dev
```
