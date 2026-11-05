# Authentication Transport and CSRF Policy

## 1. Authentication Strategy

ToothCare Hub implements **stateful, server-side PHP sessions authenticated via HttpOnly cookies** for browser applications.

```mermaid
sequenceDiagram
    autonumber
    actor User as Patient / Clinic Staff
    participant Browser as React Frontend (Vite)
    participant Nginx as Nginx Proxy (:80 / :8080)
    participant API as PHP REST API (/api/v1)
    participant DB as MySQL Database

    User->>Browser: Enters email and password
    Browser->>API: POST /api/v1/auth/login {email, password}
    API->>DB: Query user, verify password_verify(password, hash)
    Note over API: Regenerate session ID: session_regenerate_id(true)
    API-->>Browser: 200 OK + Set-Cookie: toothcare_session=...; HttpOnly; SameSite=Lax
    Browser->>API: GET /api/v1/auth/csrf-token
    API-->>Browser: 200 OK { data: { csrf_token: "..." } }
    Note over Browser: Stores csrf_token in memory / Axios state
    User->>Browser: Requests Appointment
    Browser->>API: POST /api/v1/appointments (Cookie + X-CSRF-Token)
    API->>API: CsrfMiddleware checks hash_equals($_SESSION['csrf_token'], header)
    API-->>Browser: 201 Created
```

### Security Rules
1. **No Tokens in `localStorage`**: Long-lived authentication tokens, passwords, and sensitive identifiers must NEVER be placed in browser `localStorage` or `sessionStorage` (mitigates XSS credential theft).
2. **Session Cookie Flags**:
   - `HttpOnly`: Strictly `true` across all environments. JavaScript cannot read `document.cookie`.
   - `SameSite`: `Lax` (provides CSRF protection for top-level navigations while permitting same-site app requests).
   - `Secure`: `false` in local HTTP development (`APP_ENV=development`), enforced `true` in staging and production.
   - `Path`: `/`.
3. **Session ID Regeneration**: `session_regenerate_id(true)` is executed upon every privilege change (login, logout, password change) to prevent session fixation.
4. **Session Expiration**: Inactivity timeout set to 120 minutes (`SESSION_LIFETIME=7200`).

---

## 2. Anti-CSRF Token Policy

To protect state-changing HTTP requests from cross-site request forgery, the API enforces double-check CSRF validation:

### 2.1 Safe Methods (Bypassed)
The following idempotent methods do NOT require a CSRF token:
- `GET`
- `HEAD`
- `OPTIONS`

### 2.2 Unsafe Methods (Enforced)
State-changing methods require a valid CSRF token whenever an authenticated session is active:
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

### 2.3 Token Transport
- **Header**: `X-CSRF-Token: <64-char-hex>`
- **Fallback**: Body property `_csrf_token: <64-char-hex>`
- **Validation**: Handled in `App\Middleware\CsrfMiddleware` using constant-time string comparison: `hash_equals($_SESSION['csrf_token'], $clientToken)`.
- If invalid or missing, the API rejects the request immediately with HTTP `403 Forbidden` (`CSRF_TOKEN_INVALID`).

---

## 3. Frontend Axios Integration Guide

In `frontend/src/services/api.ts` (or `axiosClient.ts`), Axios is configured to send cookies automatically and attach both the CSRF token and the request ID to all outgoing calls:

```typescript
import axios, { type InternalAxiosRequestConfig } from 'axios';

let csrfToken: string | null = null;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
  withCredentials: true, // CRITICAL: instructs browser to send HttpOnly session cookie
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

// Fetch CSRF token during app bootstrap
export async function initializeCsrf(): Promise<string> {
  const response = await apiClient.get<{ data: { csrf_token: string } }>('/auth/csrf-token');
  csrfToken = response.data.data.csrf_token;
  return csrfToken;
}

// Request interceptor: attach CSRF token to state-changing methods
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfToken) {
    config.headers.set('X-CSRF-Token', csrfToken);
  }
  return config;
});

// Response interceptor: handle 401 session expiry or 403 CSRF mismatch
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Session expired -> redirect to login
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    } else if (error.response?.data?.error?.code === 'CSRF_TOKEN_INVALID') {
      // CSRF token desynchronized -> refresh token once
      await initializeCsrf();
    }
    return Promise.reject(error);
  }
);
```

