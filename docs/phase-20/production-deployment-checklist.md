# Production Deployment Checklist (Phase 20)

| Gate | Requirement | Status |
|---|---|---|
| **Immutable Images** | Exact staging-tested `IMAGE_TAG` / SHA-256 digests pinned in deployment env | **READY (Process Defined)** |
| **Environment & Secrets** | Production `.env` / secret store populated; `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_COOKIE_SECURE=true`, unique secrets | **PRE-DEPLOY OPERATOR ACTION** |
| **DB Accounts** | Separate runtime (`DB_USER`), exporter (`MYSQL_EXPORTER_USER`), and migration credentials | **PRE-DEPLOY OPERATOR ACTION** |
| **TLS & WSS** | Valid CA certs mounted at `./docker/nginx/ssl/`; `production-tls.conf.example` enabled; HTTPS redirect & WSS verified | **BLOCKED ON DOMAIN/CA CERTS** |
| **Pre-Deploy Backup** | Fresh encrypted pre-migration backup verified via SHA-256 manifest | **PRE-DEPLOY OPERATOR ACTION** |
| **Migrations** | `php database/migrate.php` executed cleanly against production MySQL 8 | **PRE-DEPLOY OPERATOR ACTION** |
| **Container Health** | All containers `healthy`; only Nginx `80`/`443` publicly exposed | **VERIFY AT CUTOVER** |
| **Monitoring** | `--profile monitoring --profile monitoring-linux` targets `UP`; Grafana anonymous disabled | **VERIFY AT CUTOVER** |
| **Rollback Ready** | Previous known-good image tags/digests recorded and accessible locally or in registry | **PRE-DEPLOY OPERATOR ACTION** |
