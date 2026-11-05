# Cross-Origin Resource Sharing (CORS) Policy

## 1. Overview and Security Principles

CORS protects the ToothCare Hub API from unauthorized browser origins attempting to forge requests or read response payloads.

Because the API uses credentialed sessions (`withCredentials: true`, HttpOnly cookies), browsers enforce strict requirements:
1. `Access-Control-Allow-Origin` cannot be wildcard `*` when credentials are permitted.
2. The server must reflect the exact allowed origin.
3. Every response must include `Vary: Origin` to prevent intermediate caches from serving origin-specific responses to another client.

---

## 2. Configuration Parameters

In `backend/.env`:

```dotenv
# Comma-separated list of exact allowed origins
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080

# Maximum seconds client may cache preflight response
CORS_MAX_AGE=86400
```

### Environment Rules
| Environment | Allowed Origins | Secure Cookies | Notes |
|---|---|---|---|
| **Development** | `http://localhost:5173`, `http://127.0.0.1:5173` | `false` | Vite local development server. |
| **Staging** | `https://staging.toothcarehub.com` | `true` | Explicit HTTPS origin only. |
| **Production** | `https://app.toothcarehub.com`, `https://toothcarehub.com` | `true` | Strictest HTTPS enforcement. |

---

## 3. Preflight Handling (`OPTIONS`)

Preflight requests are processed immediately by `App\Middleware\CorsMiddleware`:
- HTTP Method: `OPTIONS`
- Response Status: `204 No Content`
- Emitted Headers for approved origins:
  - `Access-Control-Allow-Origin: <origin>`
  - `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-ID, X-CSRF-Token, Accept`
  - `Access-Control-Max-Age: 86400`
  - `Vary: Origin`

If an incoming request presents an origin that is **not** in `CORS_ALLOWED_ORIGINS`, no `Access-Control-Allow-*` headers are attached to the response. The browser automatically blocks the client from reading the response.

