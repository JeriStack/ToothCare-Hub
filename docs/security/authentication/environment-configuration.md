# Environment Variables and Security Configuration

## 1. Overview

ToothCare Hub relies on environment variables for sensitive settings, database connection details, cookie flags, and rate limiting thresholds.

Development defaults are defined in `.env.example` and `backend/.env.example`. Actual secrets must never be committed to source control.

---

## 2. Configuration Inventory

### Authentication, Session & CSRF Security

| Variable | Default (Dev) | Production Recommended | Description |
|---|---|---|---|
| `SESSION_COOKIE_NAME` | `toothcare_session` | `toothcare_session` | Name of the session cookie |
| `SESSION_LIFETIME` | `7200` | `7200` | Session lifetime in seconds (2 hours) |
| `SESSION_COOKIE_SECURE`| `false` | `true` | Enforces HTTPS-only transmission |
| `SESSION_COOKIE_SAMESITE`| `Lax` | `Lax` | SameSite cookie policy (`Lax` or `Strict`) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8080` | `https://toothcarehub.example.com` | Whitelisted frontend origins |
| `CORS_MAX_AGE` | `86400` | `86400` | Preflight cache lifetime in seconds |

### Password Policy & Token Security

| Variable | Default | Description |
|---|---|---|
| `AUTH_PASSWORD_MIN_LENGTH` | `12` | Minimum character length for user passwords |
| `EMAIL_VERIFICATION_TOKEN_TTL`| `86400` | Email verification token time-to-live (24 hours) |
| `PASSWORD_RESET_TOKEN_TTL` | `1800` | Password reset token time-to-live (30 minutes) |

### Rate Limiting & Abuse Prevention

| Variable | Default | Description |
|---|---|---|
| `AUTH_LOGIN_RATE_LIMIT` | `5` | Maximum failed login attempts allowed per identifier |
| `AUTH_LOGIN_RATE_WINDOW` | `900` | Failed login attempt sliding window (15 minutes) |
| `AUTH_REGISTER_RATE_LIMIT` | `5` | Maximum registrations per client IP per hour |
| `AUTH_REGISTER_RATE_WINDOW` | `3600` | Registration rate limit window in seconds (1 hour) |
| `AUTH_PASSWORD_RESET_RATE_LIMIT` | `3` | Maximum reset requests per client IP / email |
| `AUTH_PASSWORD_RESET_RATE_WINDOW` | `3600` | Reset request window in seconds (1 hour) |

