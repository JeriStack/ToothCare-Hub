# Authentication Architecture

## 1. Overview and Security Principles

ToothCare Hub implements session-based authentication using standard server-side PHP sessions and credentialed HTTP cookies. No authentication secrets, JWTs, or session tokens are stored in the browser's `localStorage` or `sessionStorage`.

```text
Browser / Mobile Client
       |
       | 1. POST /auth/login { email, password }
       v
Nginx Edge Proxy (:8080 / :80)
       |
       | 2. Pass request to PHP-FPM API
       v
PHP-FPM Pipeline
       |-- RequestIdMiddleware (Attaches UUID v4 X-Request-ID)
       |-- CorsMiddleware (Credentials allowed, explicit origin)
       |-- RateLimitMiddleware (Checks IP & email failure thresholds)
       |-- CsrfMiddleware (Verifies X-CSRF-Token on state-changing calls)
       |
       v
AuthController -> AuthService
       |-- Normalize email: strtolower(trim(email))
       |-- UserRepository: Lookup user by normalized email
       |-- password_verify($password, $user['password_hash'])
       |-- Check $user['is_active'] === 1
       |-- session_regenerate_id(true) [Fixation Prevention]
       |-- Store $_SESSION['user_id'] and role context
       |-- AuditLogRepository: Record AUTH_LOGIN_SUCCESS
       |
       v
Response Envelope
       Set-Cookie: toothcare_session=<session_id>; Path=/; HttpOnly; SameSite=Lax
       {
         "data": { "id": 1, "email": "patient@example.com", "role": "PATIENT", ... },
         "meta": { "request_id": "3c26210f-..." },
         "error": null
       }
```

---

## 2. Cookie Security Specifications

| Attribute | Setting | Rationale |
|---|---|---|
| `Name` | `toothcare_session` | Isolated, customizable via `SESSION_COOKIE_NAME` |
| `HttpOnly` | `true` | Prevents JavaScript (`document.cookie`) from reading the cookie, defeating XSS token theft |
| `Secure` | `false` in development, `true` in production | Ensures session cookie is only transmitted over TLS/HTTPS in staging/production |
| `SameSite` | `Lax` | Prevents CSRF leakage on cross-site requests while permitting top-level navigation |
| `Lifetime` | 7200s (2 hours) | Enforces automatic session expiration after inactivity |
| `Strict Mode` | `session.use_strict_mode = 1` | Rejects uninitialized session IDs provided by client |

---

## 3. Password Policy and Hashing

- **Algorithm**: `PASSWORD_DEFAULT` (currently Bcrypt with dynamic cost factor; automatically forward-compatible with Argon2id).
- **Verification**: `password_verify($submittedPassword, $storedHash)`.
- **Rehashing**: Checked upon every successful login using `password_needs_rehash()`. If system algorithm or cost parameters increase, hash is automatically updated without requiring password resets.
- **Complexity Requirements**:
  - Minimum 12 characters (`AUTH_PASSWORD_MIN_LENGTH=12`).
  - At least one uppercase character (`A-Z`).
  - At least one lowercase character (`a-z`).
  - At least one numeric digit (`0-9`).
  - At least one special/symbol character (`[^A-Za-z0-9]`).

---

## 4. Unauthenticated vs Authenticated Requests

1. **Unauthenticated Endpoints**:
   - `POST /api/v1/auth/register`
   - `POST /api/v1/auth/login`
   - `GET /api/v1/auth/csrf-token`
   - `POST /api/v1/auth/verify-email`
   - `POST /api/v1/auth/resend-verification`
   - `POST /api/v1/auth/forgot-password`
   - `POST /api/v1/auth/reset-password`
   - `GET /api/v1/health`
2. **Authenticated Endpoints** (Protected by `AuthenticationMiddleware`):
   - `POST /api/v1/auth/logout`
   - `GET /api/v1/auth/me`
   - `GET /api/v1/patients/{id}` (Requires ownership or admin)
   - `PATCH /api/v1/patients/{id}` (Requires ownership or admin)
   - `GET /api/v1/admin/audit-logs` (Requires `ADMIN` role)

