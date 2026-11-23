# Real-Time Dashboard Synchronization

Dashboard synchronization is decoupled from notification UI components in:
- `frontend/src/services/realtime/dashboardSync.js`
- `frontend/src/hooks/useDashboardSync.js`

## Event-to-Domain Mapping

| Domain Event | Affected Domains | Authorized Roles Refreshed |
|---|---|---|
| `appointment.requested` | `appointments`, `admin_dashboard`, `receptionist_dashboard`, `dentist_dashboard`, `patient_dashboard` | Admin, Receptionist, Dentist, Patient |
| `appointment.confirmed` | `appointments`, `admin_dashboard`, `receptionist_dashboard`, `dentist_dashboard`, `patient_dashboard` | Admin, Receptionist, Dentist, Patient |
| `appointment.rejected` | `appointments`, `admin_dashboard`, `receptionist_dashboard`, `dentist_dashboard`, `patient_dashboard` | Admin, Receptionist, Dentist, Patient |
| `appointment.cancelled` | `appointments`, `schedules`, all 4 dashboards | Admin, Receptionist, Dentist, Patient |
| `appointment.rescheduled` | `appointments`, `schedules`, all 4 dashboards | Admin, Receptionist, Dentist, Patient |
| `appointment.updated` | `appointments`, all 4 dashboards | Admin, Receptionist, Dentist, Patient |
| `schedule.updated` | `schedules`, `admin_dashboard`, `receptionist_dashboard`, `dentist_dashboard` | Admin, Receptionist, Dentist |
| `service.updated` | `services`, `admin_dashboard`, `receptionist_dashboard` | Admin, Receptionist |
| `account.created` | `accounts`, `admin_dashboard`, `receptionist_dashboard` | Admin, Receptionist |
| `account.updated` | `accounts`, `admin_dashboard` | Admin |

## Consistency & Performance Safeguards

- **Zero Full-Page Reloads**: Dashboards invoke silent background REST fetches (`fetchMetrics(true)`, `fetchDashboardData(true)`, `fetchDashboard(true)`), keeping visible content rendered without skeleton flicker.
- **Debouncing / Batching**: Rapid bursts of domain events within `250ms` coalesce into a single REST refresh per active view.
- **Deduplication**: Event IDs are deduplicated in both `RealtimeProvider` (500-entry LRU) and `useDashboardSync` (250-entry LRU).
- **Reconnect Recovery**: WebSocket reconnection and browser tab visibility restoration trigger both `GET /api/v1/notifications/sync?after_id=...` and targeted refreshes of mounted dashboards.
- **Graceful Degradation**: During WebSocket outages, `ConnectionStatus` displays `Sync mode` / `Reconnecting`, all REST actions remain operational, and `useNotifications` falls back to periodic REST polling.
