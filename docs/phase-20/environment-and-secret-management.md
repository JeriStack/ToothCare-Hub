# Environment & Secret Management Policy

## 1. Credential Separation

| Identity | Scope | Minimum Required Privileges |
|---|---|---|
| **Application Runtime DB User (`DB_USER`)** | `php-fpm`, `email-worker`, `realtime-worker`, `reminder-scheduler` | `SELECT, INSERT, UPDATE, DELETE` on `toothcare_hub` only (no `DROP`/`ALTER`/`SUPER`) |
| **Monitoring DB Exporter (`MYSQL_EXPORTER_USER`)** | `mysqld-exporter` | `PROCESS, REPLICATION CLIENT, SELECT ON performance_schema.*` (`MAX_USER_CONNECTIONS 3`) |
| **Migration / Backup Identity** | Controlled migration runs & `db-backup` | Elevated DDL/dump privileges used strictly outside normal web runtime |

## 2. Secret Handling Rules

- `.env` files are gitignored; `.env.example`, `backend/.env.example`, `frontend/.env.example`, and `realtime/.env.example` contain placeholders only.
- `.dockerignore` blocks `.env*`, `*.pem`, `*.key`, `*.crt`, and `docker/nginx/ssl/*` from all Docker build contexts.
- Never place secrets in `VITE_*` variables (compiled into public JS bundles), Dockerfiles, image layers, or CI logs.
- All runtime secrets (`DB_PASSWORD`, `REALTIME_INTERNAL_SECRET`, `EMAIL_PAYLOAD_KEY`, `BACKUP_ENCRYPTION_KEY`, `MAIL_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`) can be rotated via externalized runtime environment/secret stores without rebuilding images.
