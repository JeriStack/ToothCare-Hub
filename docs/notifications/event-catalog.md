# Domain Event Catalog (v1.0)

All real-time events share the versioned v1.0 contract enforced identically in:
- PHP: `backend/src/Services/Realtime/RealtimeOutboxService.php`
- Node.js: `realtime/src/events/event-types.ts` & `event-validator.ts`
- React: `frontend/src/services/realtime/socket-events.js`

## Standardized Events

| Event Name | Triggering Operation | Entity Type |
|---|---|---|
| `appointment.requested` | Patient submits a new appointment request (`AppointmentService::bookAppointment`) | `appointments` |
| `appointment.confirmed` | Receptionist/Admin confirms pending request or creates front-desk confirmed booking | `appointments` |
| `appointment.rejected` | Receptionist/Admin declines pending appointment request | `appointments` |
| `appointment.cancelled` | Patient, Receptionist, or Admin cancels an appointment | `appointments` |
| `appointment.rescheduled` | Patient/Staff reschedules an appointment (atomic cancel + create) | `appointments` |
| `appointment.updated` | Check-in, attendance update (`WAITING`/`IN_CONSULTATION`/`FINISHED`/`NO_SHOW`), or appointment completion | `appointments` |
| `schedule.updated` | Dentist weekly shift created/updated/deleted or time-off scheduled/requested | `schedules` |
| `service.updated` | Dental service created, updated, activated, or deactivated | `services` |
| `account.created` | New patient self-registration, walk-in registration, or staff account creation | `accounts` |
| `account.updated` | User status activation/deactivation or role reassignment | `accounts` |
| `notification.created` | Generic persisted in-app notification event | `notifications` |

## Payload Contract (v1.0)

```json
{
  "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "eventType": "appointment.confirmed",
  "eventVersion": "1.0",
  "notificationId": 142,
  "appointmentId": 501,
  "entityType": "appointments",
  "entityId": 501,
  "status": "confirmed",
  "occurredAt": "2026-11-23T14:30:00Z"
}
```

### Forbidden Fields (Enforced Server-Side)

`realtime/src/events/event-validator.ts` rejects any envelope containing passwords, `password_hash`, `smtp_password`, `token`, `ticket`, `session_id`, `diagnosis`, `procedure_notes`, `clinical_notes`, `treatment_notes`, `prescription_notes`, `chief_complaint`, `medical_alerts`, `email`, `phone`, or `address`. Detailed records are always fetched through authorized PHP REST endpoints.
