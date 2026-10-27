# ToothCare Hub — Phase 1 Environment Configuration Guide

**Document ID:** `TCH-P1-ENV-CFG-001`  
**Version:** `1.0`  
**Phase:** `Phase 1 — Repository, Local Environment, and Team Workflow`  
**Prepared Date:** `2026-10-27`

---

## 1. Environment File Architecture

ToothCare Hub separates environment configuration across four boundary-specific files so each runtime receives only the variables it needs:

| Template File (Tracked in Git) | Local Runtime File (Ignored by Git) | Consumer | Contains Secrets? |
|---|---|---|---|
| [`.env.example`](../../.env.example) | `.env` | Docker Compose variable interpolation (`docker-compose.yml`) | Local dev DB/Grafana passwords (replace placeholders locally) |
| [`backend/.env.example`](../../backend/.env.example) | `backend/.env` | PHP REST API (`php-fpm`) & `email-worker` CLI | **Yes** (DB credentials, SMTP credentials, `REALTIME_INTERNAL_SECRET`) |
| [`frontend/.env.example`](../../frontend/.env.example) | `frontend/.env` | React + Vite build & dev server (`import.meta.env.VITE_*`) | **NEVER** — All `VITE_*` values are public in the browser bundle |
| [`realtime/.env.example`](../../realtime/.env.example) | `realtime/.env` | Node.js + Socket.IO server (`realtime/`) | **Yes** (`REALTIME_INTERNAL_SECRET`) |

---

## 2. Step-by-Step Local Setup

### Step 1: Copy Templates to Local `.env` Files

From the repository root in Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
Copy-Item realtime/.env.example realtime/.env
```

### Step 2: Populate Local Development Values

1. **Generate a Shared Internal Secret (`REALTIME_INTERNAL_SECRET`):**
   Generate a random 32-byte hex string and set the **same** value in both `backend/.env` and `realtime/.env`:
   ```powershell
   php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"
   ```
2. **Configure Database Connection (`backend/.env` and `.env`):**
   - **When running via Docker Compose:** Set `DB_HOST=mysql` in `backend/.env` and match `DB_NAME` / `DB_PASSWORD` with `.env`.
   - **When running directly on host CLI against local MariaDB/MySQL:** Set `DB_HOST=127.0.0.1` and `DB_PORT=3306`.
3. **Configure Mail (`backend/.env`):**
   - Use a local mail-capture tool (such as Mailpit/MailHog) or a non-production sandbox SMTP account (e.g., Mailtrap). Never use real patient email addresses or production clinic SMTP credentials in local development.
4. **Configure Frontend Public Endpoints (`frontend/.env`):**
   - Keep `VITE_API_BASE_URL=http://localhost:8080/api/v1` and `VITE_SOCKET_URL=http://localhost:8080` when routing through the Nginx container, or `http://localhost/ToothCare-Hub/backend/public/api/v1` and `http://localhost:4000` when running standalone local processes.

---

## 3. Variable Reference & Deployment Classification

### 3.1 Root `.env.example`
| Variable | Template Placeholder | Local Dev Default | Production Rule |
|---|---|---|---|
| `APP_ENV` | `development` | `development` | Set to `production` |
| `COMPOSE_PROJECT_NAME` | `toothcare-hub` | `toothcare-hub` | Keep consistent per environment |
| `APP_URL` | `http://localhost:8080` | `http://localhost:8080` | `https://<clinic-domain>` |
| `API_BASE_URL` | `http://localhost:8080/api/v1` | `http://localhost:8080/api/v1` | `https://<clinic-domain>/api/v1` |
| `NGINX_HTTP_PORT` | `8080` | `8080` | `80` / `443` (via `docker-compose.prod.yml`) |
| `DB_NAME` | `toothcare_hub` | `toothcare_hub` | `toothcare_hub` |
| `DB_PASSWORD` | `CHANGE_ME_LOCAL_MYSQL_ROOT_PASSWORD` | Strong local dev password | Inject via protected host secret / CI secret |
| `GRAFANA_ADMIN_USER` | `admin_placeholder` | Local admin username | Non-default admin username |
| `GRAFANA_ADMIN_PASSWORD` | `CHANGE_ME_GRAFANA_ADMIN_PASSWORD` | Local dev password | Strong secret via host secret store |

### 3.2 Backend `backend/.env.example`
| Variable | Template Placeholder | Purpose | Production Rule |
|---|---|---|---|
| `APP_ENV` | `development` | Controls error verbosity & debug routes | Must be `production` (never expose stack traces) |
| `APP_TIMEZONE` | `Asia/Manila` | Canonical clinic timezone (`DEC-POL-003`) | `Asia/Manila` |
| `SESSION_COOKIE_NAME` | `toothcare_session` | Session cookie identifier | `toothcare_session` |
| `SESSION_SECURE_COOKIE` | `false` | Requires HTTPS for cookie transmission | Must be `true` in production (HTTPS) |
| `SESSION_SAME_SITE` | `Lax` | CSRF mitigation attribute | `Lax` or `Strict` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Explicit allowed browser origins | Exact `https://<clinic-domain>` only (never `*`) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | `127.0.0.1` / `3306` / `toothcare_hub` | PDO MySQL connection target | `mysql` (internal Docker network DNS) |
| `DB_USER` / `DB_PASSWORD` | `toothcare_app_placeholder` / `CHANGE_ME_*` | Least-privilege application DB credentials | Separate least-privilege account (not `root`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_ENCRYPTION` | `smtp.example.invalid` / `587` / `tls` | PHPMailer outbound SMTP server | Authenticated TLS SMTP provider |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | `placeholder_*` / `CHANGE_ME_*` | SMTP credentials | Protected runtime secret |
| `REALTIME_INTERNAL_URL` | `http://127.0.0.1:4000/internal/publish` | Internal PHP-to-Node event endpoint | `http://realtime:4000/internal/publish` |
| `REALTIME_INTERNAL_SECRET` | `CHANGE_ME_GENERATE_32_BYTE_HEX_SECRET` | Authenticates PHP event publishing | High-entropy secret shared only with `realtime` |

### 3.3 Frontend `frontend/.env.example`
| Variable | Template Placeholder | Security Constraint |
|---|---|---|
| `VITE_APP_NAME` | `"ToothCare Hub"` | Public string bundled into client JS |
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | Public URL; never embed API keys or Basic Auth |
| `VITE_SOCKET_URL` | `http://localhost:8080` | Public WebSocket URL (`wss://` in production) |

### 3.4 Real-Time `realtime/.env.example`
| Variable | Template Placeholder | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Runtime mode (`production` in release) |
| `PORT` | `4000` | Internal Socket.IO listener port |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Handshake CORS origin allowlist |
| `BACKEND_INTERNAL_API_URL` | `http://backend:9000` | Internal PHP verification reference |
| `REALTIME_INTERNAL_SECRET` | `CHANGE_ME_GENERATE_32_BYTE_HEX_SECRET` | Must match `backend/.env` `REALTIME_INTERNAL_SECRET` |

---

## 4. Verifying That `.env` Files Remain Untracked

Before staging or committing any work, run these commands to confirm zero `.env` files are tracked by Git:

```powershell
# 1. Verify only .env.example files are tracked in the Git index
git ls-files "*.env*"
# Expected output:
# .env.example
# backend/.env.example
# frontend/.env.example
# realtime/.env.example

# 2. Verify Git actively ignores local .env files
git check-ignore -v .env backend/.env frontend/.env realtime/.env
```

