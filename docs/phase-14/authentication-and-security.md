# Phase 14 — Authentication, Rooms, and Security

## 1. Short-Lived Connection Ticket Lifecycle

1. User signs in via the existing PHP session cookie (`toothcare_session`, `HttpOnly`, `SameSite=Lax`).
2. React calls `POST /api/v1/realtime/ticket` (authenticated + CSRF protected).
3. PHP re-verifies the user is active in MySQL, resolves current role, linked `dentist_id`, and effective DRBAC permissions, and generates a 32-byte cryptographically random hex ticket (`random_bytes(32)`).
4. PHP stores only `SHA-256(ticket)` and `SHA-256(session_id)` in `realtime_tickets` with a short TTL (`REALTIME_TICKET_TTL_SECONDS`, default `60s`).
5. React passes the raw ticket **only** in Socket.IO `handshake.auth.ticket` (never in URL query parameters, never in `localStorage` or `sessionStorage`, never logged).
6. Node.js rejects any handshake that includes `ticket` or `token` in the query string (`TICKET_IN_QUERY_FORBIDDEN`).
7. Node.js sends an HMAC-SHA256 signed `POST /api/v1/internal/realtime/tickets/verify` request to PHP over the internal Docker listener (`http://nginx:8081`).
8. PHP atomically consumes the ticket (`UPDATE realtime_tickets SET used_at = NOW() WHERE ticket_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`).
9. Expired, malformed, revoked, inactive-user, or already-used tickets are rejected with `401`.

## 2. Service-to-Service Authentication (HMAC-SHA256 + Replay Protection)

Both directions (`PHP -> Node.js` and `Node.js -> PHP`) sign every internal request with `REALTIME_INTERNAL_SECRET`:

- `X-Realtime-Timestamp`: Unix epoch seconds
- `X-Realtime-Nonce`: 32-char random hex string
- `X-Realtime-Signature`: `HMAC-SHA256(secret, "{timestamp}.{nonce}.{METHOD}.{path}.{rawBody}")`

Verification enforces:
- Constant-time comparison (`hash_equals` / `crypto.timingSafeEqual`)
- Timestamp drift window (`REPLAY_WINDOW_SECONDS`, default `300s`)
- Nonce deduplication cache (rejects exact replay with `401 REPLAYED_NONCE`)
- Public Nginx port `80`/`443` explicitly blocks `/api/v1/internal/` with `403 Forbidden`; internal port `8081` is never published to the host.

## 3. Server-Controlled Rooms

Clients never choose rooms. `RoomManager.computeAuthorizedRooms()` computes membership exclusively from PHP-verified identity:

| Role | Assigned Rooms |
|---|---|
| `PATIENT` | `user:{userId}`, `role:patient` |
| `DENTIST` | `user:{userId}`, `role:dentist`, `dentist:{dentistId}` |
| `RECEPTIONIST` | `user:{userId}`, `role:receptionist`, plus `receptionist:notifications` only if `appointments.view` is granted |
| `ADMIN` | `user:{userId}`, `role:admin`, plus `admin:notifications` only if `dashboard.view` or `appointments.view` is granted |

All client-emitted room joins or business events are blocked by default (`FORBIDDEN_CLIENT_EVENT`).

## 4. Session Revocation & Revalidation

- **Logout (`AuthService::logout`)**: Revokes session tickets in `realtime_tickets` and sends signed `POST /internal/revoke` (`userId`, `sessionIdHash`, `reason: 'LOGOUT'`) so Node.js disconnects only that session's sockets.
- **Account Deactivation (`UserController::updateStatus`)**: Revokes all tickets for the user and disconnects all active sockets (`ACCOUNT_DEACTIVATED`).
- **Role / DRBAC Changes (`UserController::updateRole`, `RolePermissionController::syncRolePermissions`)**: Revokes affected tickets and disconnects affected user/role sockets so clients re-authenticate with fresh permissions.
- **Periodic Background Revalidation**: Node.js calls `POST /api/v1/internal/realtime/sessions/verify` on `SESSION_REVALIDATE_INTERVAL_MS` to catch out-of-band deactivation or role changes.
