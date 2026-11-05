# Environment Variables Reference

All runtime configuration for the native PHP REST API is controlled via environment variables loaded by `App\Core\Config` through `vlucas/phpdotenv`.

In local development, variables are defined in `backend/.env` (copied from `backend/.env.example`).
In Docker Compose, values can be provided directly via the root `.env` or service definitions.

---

## 1. Application & Core Settings

| Variable | Type | Default | Description | Sensitivity |
|---|---|---|---|---|
| `APP_ENV` | String | `development` | Environment mode (`development`, `testing`, `staging`, `production`). In `production`, debug output is automatically disabled. | Low |
| `APP_DEBUG` | Boolean | `false` | Whether to include diagnostic details in logs and development errors. | Low |
| `APP_URL` | String | `http://localhost:8080` | Public base URL of the application. | Low |
| `APP_TIMEZONE` | String | `Asia/Manila` | Default application timezone (UTC+08:00). | Low |
| `API_BASE_PATH` | String | `/api/v1` | URL path prefix for API endpoints. | Low |
| `LOG_LEVEL` | String | `debug` | Minimum log severity to write (`debug`, `info`, `warning`, `error`, `critical`). | Low |
| `LOG_PATH` | String | `backend/storage/logs/app.log` | Absolute or relative filesystem path to application log file. | Low |
| `REQUEST_BODY_MAX_BYTES` | Integer | `1048576` | Maximum allowed request body size in bytes (1MB default). Exceeding this triggers `413 Payload Too Large`. | Low |

---

## 2. Database Settings (PDO / MySQL)

| Variable | Type | Default | Description | Sensitivity |
|---|---|---|---|---|
| `DB_HOST` | String | `127.0.0.1` | MySQL server host (`mysql` inside Docker Compose, `127.0.0.1` for local host CLI / XAMPP). | Medium |
| `DB_PORT` | Integer | `3306` | MySQL TCP port. | Low |
| `DB_DATABASE` | String | `toothcare_hub` | MySQL database schema name. Alias `DB_NAME` is also supported. | Low |
| `DB_USERNAME` | String | `toothcare_app` | Database username. Alias `DB_USER` is also supported. | Medium |
| `DB_PASSWORD` | String | `""` | Database password. NEVER commit to Git. | **High** |
| `DB_CHARSET` | String | `utf8mb4` | Connection character set. | Low |

---

## 3. Session & Security Settings

| Variable | Type | Default | Description | Sensitivity |
|---|---|---|---|---|
| `SESSION_COOKIE_NAME` | String | `toothcare_session` | Name of the session cookie issued to browser clients. | Low |
| `SESSION_LIFETIME` | Integer | `7200` | Session idle timeout in seconds (2 hours default). | Low |
| `SESSION_COOKIE_SECURE` | Boolean | `false` | When `true`, cookie is only transmitted over HTTPS. Must be `true` in production. | Medium |
| `SESSION_COOKIE_SAMESITE`| String | `Lax` | SameSite attribute (`Lax`, `Strict`, or `None`). | Medium |
| `CORS_ALLOWED_ORIGINS` | List | `http://localhost:5173` | Comma-separated list of exact allowed browser origins. Wildcard `*` is disallowed when credentials are enabled. | High |
| `CORS_MAX_AGE` | Integer | `86400` | Preflight cache lifetime in seconds (24 hours). | Low |

---

## 4. Mail Settings (PHPMailer / Transactional SMTP)

| Variable | Type | Default | Description | Sensitivity |
|---|---|---|---|---|
| `MAIL_MAILER` | String | `smtp` | Mail driver (`smtp` or `log`). | Low |
| `MAIL_HOST` | String | `mailpit` | SMTP host (`mailpit` in Docker Compose, SMTP relay in production). | Medium |
| `MAIL_PORT` | Integer | `1025` | SMTP port (1025 for Mailpit, 587/465 for TLS/SSL relays). | Low |
| `MAIL_USERNAME` | String | `""` | SMTP authentication username. | Medium |
| `MAIL_PASSWORD` | String | `""` | SMTP authentication password. | **High** |
| `MAIL_ENCRYPTION` | String | `tls` | Transport encryption (`tls`, `ssl`, or empty). | Low |
| `MAIL_FROM_ADDRESS` | String | `noreply@toothcarehub.local` | Clinic sender email address. | Low |
| `MAIL_FROM_NAME` | String | `ToothCare Hub` | Clinic sender display name. | Low |

---

## 5. Real-Time Settings (Socket.IO Bridge)

| Variable | Type | Default | Description | Sensitivity |
|---|---|---|---|---|
| `REALTIME_HOST` | String | `realtime` | Internal hostname of the Node.js Socket.IO microservice. | Medium |
| `REALTIME_PORT` | Integer | `3001` | Internal HTTP port for publishing events from PHP to Node. | Low |
| `REALTIME_SECRET` | String | `""` | Shared secret key for authenticating internal publishing requests. | **High** |

