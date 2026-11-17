# Session Management and Lifecycle

## 1. Session Lifecycle

```text
  [ Unauthenticated Client ]
              |
              | POST /api/v1/auth/login
              v
       Credentials Verified
              |
              | 1. session_regenerate_id(true) [Destroys old session ID]
              | 2. Populate $_SESSION['user_id', 'user_role', 'csrf_token']
              | 3. Set Set-Cookie: toothcare_session=...
              v
   [ Authenticated Session ]
              |
              |-- Requests with Cookie: toothcare_session=...
              |-- Handled by AuthenticationMiddleware
              |-- Expiration: 7200 seconds of inactivity
              |
              | POST /api/v1/auth/logout
              v
       Session Invalidation
              | 1. $_SESSION = []
              | 2. Set-Cookie: toothcare_session=deleted; Max-Age=0; Path=/
              | 3. session_destroy()
              v
  [ Terminated Session ]
```

---

## 2. Session Fixation Mitigation

When a user logs in, `AuthService::login` invokes:

```php
session_regenerate_id(true);
```

The `true` argument ensures the previous session data file on the server is permanently deleted, preventing session fixation attacks where an attacker pre-seeds a session identifier.

---

## 3. Session Security Directives

Configured in `AuthService::initializeSession()`:

- `session.use_strict_mode = 1`: The engine rejects uninitialized session IDs supplied in the `Cookie` header and issues a new valid session ID.
- `session.use_only_cookies = 1`: Disables URL-based session passing (`PHPSESSID` in query parameters).
- `session.cookie_httponly = 1`: Ensures the session cookie cannot be read by clientside JavaScript.
- `session.cookie_samesite = Lax`: Ensures the cookie is omitted on cross-site subrequests (CSRF protection) while allowing standard top-level redirects.
- `session.cookie_secure = true`: Enabled when `APP_ENV === 'production'`.

