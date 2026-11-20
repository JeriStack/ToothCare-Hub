# Phase 14 — Notification Persistence and Reconnection Recovery

## Persistent Source of Truth

All user-visible notifications are stored in MySQL (`notifications` table) **inside the same database transaction** as the triggering appointment state change, along with the corresponding `realtime_outbox` record.

Migration `031_create_realtime_tables.sql` extends `notifications.role` to `ENUM('ADMIN', 'RECEPTIONIST', 'DENTIST', 'PATIENT')` and creates `realtime_tickets` and `realtime_outbox`.

## Reconnection & Recovery Flow

ToothCare Hub never relies on in-memory Socket.IO event replay to recover missed notifications.

1. When a network drop occurs, `RealtimeSocketClient` transitions status to `reconnecting` and schedules a bounded exponential backoff retry.
2. Before reconnecting, the client requests a **fresh single-use ticket** from `POST /api/v1/realtime/ticket`.
3. Upon successful Socket.IO `connect`, `RealtimeProvider` triggers `onReconnect` callbacks.
4. `useNotifications` fetches the latest authoritative state from `GET /api/v1/notifications?per_page=20` (returning items and `unread_count`).
5. Items are deduplicated by `notification.id`, unread counts are reconciled cleanly, and any notifications missed during the outage appear immediately.
6. Returning to a background browser tab (`visibilitychange`) also triggers a background REST reconciliation.
7. Refreshing the browser reloads all persisted notifications directly from PHP/MySQL.

## Connection Status Feedback

`ConnectionStatus` renders a subtle, theme-aware indicator inside the existing `NotificationCenter` header:
- `Live` (`connected`)
- `Connecting` (`connecting`)
- `Reconnecting` (`reconnecting`)
- `Sync mode` (`disconnected` — REST polling remains active)
