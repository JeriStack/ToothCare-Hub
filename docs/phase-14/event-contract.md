# Phase 14 — Real-Time Event Contract

## Approved Event Allowlist

Only these five event names are permitted across PHP, Node.js, and React:

1. `appointment.requested`
2. `appointment.confirmed`
3. `appointment.rejected`
4. `appointment.cancelled`
5. `notification.created`

Unknown or forged event names are rejected with `422` at `/internal/publish`.

## Minimal Safe Payload Schema

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "appointment.confirmed",
  "notificationId": 123,
  "appointmentId": 456,
  "status": "confirmed",
  "occurredAt": "2026-11-20T10:30:00Z"
}
```

### Privacy & Minimization Rules

The following fields are strictly forbidden in real-time payloads and rejected by `validatePublishEnvelope()`:
- Passwords, password hashes, auth tokens, tickets, session IDs
- Clinical data: `diagnosis`, `procedure_notes`, `clinical_notes`, `prescription_notes`, `chief_complaint`, `medical_alerts`
- Personal contact PII: `email`, `phone`, `address`

React retrieves full notification titles/messages and appointment details exclusively via the authenticated PHP REST API (`/api/v1/notifications`, `/api/v1/appointments/{id}`).

## Recipient Targeting Policy

| Event | Authorized Recipients |
|---|---|
| `appointment.requested` | Patient (`PATIENT`), Assigned Dentist (`DENTIST`), Active Receptionists & Administrators (`RECEPTIONIST`, `ADMIN`) |
| `appointment.confirmed` | Patient (`PATIENT`), Assigned Dentist (`DENTIST`) |
| `appointment.rejected` | Patient (`PATIENT`) |
| `appointment.cancelled` | Patient (`PATIENT`), Assigned Dentist (`DENTIST`), Active Receptionists when cancelled by patient |
| `notification.created` | Explicit target user (e.g. Patient on appointment completion) |

## Delivery Semantics & Idempotency

- **Guarantee**: At-least-once publication after MySQL commit (`realtime_outbox`), with idempotent handling at both Node.js (`RealtimeEventHandler` bounded TTL cache keyed by `eventId`) and React (`RealtimeProvider` `seenEventIds` Set + `useNotifications` notification ID deduplication).
- **Retries**: Exponential backoff (`5s`, `15s`, `60s`, `300s`, `900s`) up to `REALTIME_WORKER_MAX_ATTEMPTS` (default `5`), then marked `FAILED_PERMANENT`.
