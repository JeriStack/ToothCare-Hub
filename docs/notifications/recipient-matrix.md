# Role-Based Recipient Policy Matrix

All recipient resolution is enforced server-side in `App\Services\Notifications\UnifiedNotificationDispatcher` using active user state, resource ownership, and DRBAC permissions.

| Event | ADMIN | RECEPTIONIST | DENTIST | PATIENT | Persistence & Toast Behavior |
|---|---|---|---|---|---|
| `appointment.requested` | Active users with `appointments.view` | Active users with `appointments.view` | Assigned dentist (`dentist_user_id`) only | Owning patient (`patient_user_id`) only | Persisted + toast for all resolved recipients |
| `appointment.confirmed` | Active users with `appointments.view` | Active users with `appointments.view` | Assigned dentist only | Owning patient only | Persisted + toast for non-actor recipients; acting staff receives sync-only (`notificationId: null`) |
| `appointment.rejected` | Active users with `appointments.view` | Active users with `appointments.view` | Assigned dentist only | Owning patient only | Persisted + toast for non-actor recipients; acting staff receives sync-only |
| `appointment.cancelled` | Active users with `appointments.view` | Active users with `appointments.view` | Assigned dentist only | Owning patient only | Persisted + toast for non-actor recipients; acting staff receives sync-only |
| `appointment.rescheduled` | Active users with `appointments.view` | Active users with `appointments.view` | Assigned dentist only | Owning patient only | Persisted + toast for all resolved recipients |
| `appointment.updated` | Active users with `appointments.view` | Active users with `appointments.view` | Assigned dentist only | Owning patient only | Persisted + toast for non-actor recipients; actor receives sync-only |
| `schedule.updated` | Active users with `dentists.view` | Active users with `dentists.view` | Affected dentist (`dentist_id -> user_id`) only | Excluded | Persisted + toast for non-actor recipients |
| `service.updated` | Active users with `services.view` | Active users with `services.view` | Excluded | Excluded | Persisted + toast for non-actor recipients |
| `account.created` | Active users with `users.view` | Excluded | Excluded | Excluded | Persisted + toast for non-actor Admins |
| `account.updated` | Active users with `users.view` | Excluded | Target user only if active | Target user only if active | Persisted + toast for non-actor Admins + active target user |

## Privacy & Isolation Guarantees

- Patients never receive another patient's events or clinic-wide operational events (`service.updated`, `schedule.updated`, `account.created`).
- Dentists only receive appointment and schedule events bound to their own `dentist_id` / `user_id`.
- Receptionists do not receive Administrator-only `account.created` / `account.updated` events.
- Duplicate user IDs in any resolution pass are deduplicated before insert/enqueue.
