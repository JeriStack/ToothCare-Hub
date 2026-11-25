# WebSocket Authentication, Rooms & Security

## 1. Short-Lived Single-Use Ticket Handshake

1. Authenticated React client calls `POST /api/v1/realtime/ticket` (cookie-authenticated, CSRF-protected, rate-limited at 60/min).
2. `RealtimeTicketService` stores only `SHA-256(rawTicket)` in `realtime_tickets` bound to `user_id`, `role`, `dentist_id`, `session_id_hash`, DRBAC permissions, and short TTL.
3. React holds the raw ticket strictly in ephemeral memory (never `localStorage`/`sessionStorage`) and passes it in Socket.IO `auth.ticket` (never query strings or URLs).
4. Node.js verifies and atomically consumes the ticket via HMAC-SHA256 signed `POST /api/v1/internal/realtime/tickets/verify`. Expired, replayed, revoked, or disabled-account tickets are rejected.

## 2. Server-Controlled Room Assignment

`RoomManager.computeAuthorizedRooms()` assigns rooms strictly from the verified PHP identity:
- `user:{userId}` — primary private delivery room for all targeted events.
- `role:{role}` — verified role room.
- `dentist:{dentistId}` — assigned only when `role === 'DENTIST'` and `dentistId > 0`.
- `receptionist:notifications` — assigned only when `role === 'RECEPTIONIST'` with `appointments.view`.
- `admin:notifications` — assigned only when `role === 'ADMIN'` with `dashboard.view` or `appointments.view`.

Client-emitted room join/leave or privileged events are blocked by `authorization.middleware.ts` and counted via `toothcare_realtime_unauthorized_client_events_total`.

## 3. Protected Internal Publishing & Revocation

- Nginx blocks `/internal/*` and `/api/v1/internal/*` at the public edge; communication occurs over the private Docker `app` network only.
- `POST /internal/publish` and `POST /internal/revoke` require valid HMAC-SHA256 headers (`X-Realtime-Signature`, `X-Realtime-Timestamp`, `X-Realtime-Nonce`) with replay-window enforcement.
- Logout (`AuthService::logout`), account deactivation (`UserController::updateStatus`), and role/permission changes (`UserController::updateRole`, `RolePermissionController::syncRolePermissions`) revoke tickets and push immediate socket disconnection via `/internal/revoke`.
- Periodic session revalidation disconnects sockets if a user is deactivated or changes role while connected.
