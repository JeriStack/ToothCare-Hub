# Authentication & Session Security

ToothCare Hub uses **server-side PHP cookie sessions** combined with a **CSRF synchronizer token** (`X-CSRF-Token`). It does **not** use JWT Bearer tokens in `localStorage`.

---

## 1. Security Schemes

| OpenAPI Scheme | Type | Name | Notes |
|---|---|---|---|
| `CookieAuth` | `apiKey` (`in: cookie`) | `toothcare_session` | `HttpOnly`, `SameSite=Lax`, `Secure` when HTTPS is enabled |
| `CsrfToken` | `apiKey` (`in: header`) | `X-CSRF-Token` | Required on all state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) |

---

## 2. Standard Login Flow

1. **Fetch a CSRF token** (also initializes a session cookie if not yet present):
   ```http
   GET /api/v1/auth/csrf-token
   ```
   Response includes `data.csrf_token`.
2. **Authenticate**:
   ```http
   POST /api/v1/auth/login
   Content-Type: application/json
   X-CSRF-Token: <csrf_token>

   {
     "email": "patient.demo@example.com",
     "password": "SyntheticPass123!"
   }
   ```
   - On success (`200 OK`), the backend regenerates the session ID (`session_regenerate_id(true)`), sets `toothcare_session`, and returns the authenticated user profile and rotated CSRF token.
   - Invalid credentials return `401 Unauthorized`.
   - Unverified accounts (when email verification is enforced) or suspended accounts return `403 Forbidden`.
   - Excessive failed attempts trigger rate limiting (`429 Too Many Requests`).
3. **Verify active session**:
   ```http
   GET /api/v1/auth/me
   ```
   Returns `200 OK` with user profile and resolved permissions, or `401 Unauthorized` when unauthenticated.
4. **Logout**:
   ```http
   POST /api/v1/auth/logout
   X-CSRF-Token: <csrf_token>
   ```
   Destroys the server-side session, expires `toothcare_session`, and revokes active real-time WebSocket sessions.

---

## 3. Registration, Email Verification & Password Reset

- `POST /api/v1/auth/register` — Creates a `PATIENT` account (`201 Created`) and queues a verification email in `email_outbox`.
- `POST /api/v1/auth/verify-email` — Consumes a one-time verification token (`200 OK` or `400`/`422`).
- `POST /api/v1/auth/resend-verification` — Rate-limited resend of verification email (`200 OK`).
- `POST /api/v1/auth/forgot-password` (alias: `/auth/password/forgot`) — Generic `200 OK` response to prevent account enumeration.
- `POST /api/v1/auth/reset-password` (alias: `/auth/password/reset`) — Validates reset token and updates password hash (`bcrypt`).

---

## 4. Real-Time Socket.IO Authentication

Browser clients do not send PHP session cookies directly to Socket.IO for authorization alone. Instead:

1. Authenticated client requests a short-lived, single-use ticket:
   ```http
   POST /api/v1/realtime/ticket
   X-CSRF-Token: <csrf_token>
   ```
2. Client connects to `/socket.io/` passing the ticket in the Socket.IO `auth` handshake payload.
3. The Node.js `realtime` service verifies the ticket over the internal Docker network (`POST http://nginx:8081/api/v1/internal/realtime/tickets/verify`).
