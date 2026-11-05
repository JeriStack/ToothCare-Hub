# Cross-Site Request Forgery (CSRF) Protection

## 1. Threat Model & Mechanism

Because ToothCare Hub utilizes cookie-based authentication, modern browsers automatically attach the session cookie to cross-origin requests unless strictly partitioned or protected.

ToothCare Hub implements defense-in-depth:
1. `SameSite=Lax` on session cookies.
2. Synchronizer Token Pattern (CSRF Token):
   - Cryptographically random 256-bit token (`bin2hex(random_bytes(32))`).
   - Stored in server session (`$_SESSION['csrf_token']`).
   - Delivered to frontend via `GET /api/v1/auth/csrf-token`.
   - Sent by frontend via the `X-CSRF-Token` HTTP header on unsafe requests (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Validated via constant-time comparison (`hash_equals()`).

---

## 2. Server Validation Pipeline

In `App\Middleware\CsrfMiddleware`:

```php
public function handle(Request $request, callable $next): Response
{
    $method = $request->getMethod();
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return $next($request);
    }

    if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['csrf_token'])) {
        $sessionToken = (string) $_SESSION['csrf_token'];
        $clientToken = $request->getHeader('x-csrf-token') ?? (string) $request->input('_csrf_token', '');

        if ($clientToken === '' || !hash_equals($sessionToken, $clientToken)) {
            throw HttpException::csrfInvalid('CSRF token validation failed.');
        }
    }

    return $next($request);
}
```

---

## 3. Frontend Client Integration

In `frontend/src/lib/apiClient.js`:

```javascript
// Automatically fetch & attach CSRF token to state-changing requests
apiClient.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (unsafeMethods.includes(method) && !config.headers['X-CSRF-Token']) {
    const token = await fetchCsrfToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    }
  }

  return config;
});
```

