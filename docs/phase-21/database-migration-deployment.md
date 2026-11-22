# Controlled Database Migration Deployment

## 1. Execution Sequence (Automated in `deployment/scripts/deploy.sh`)

1. **Staging First:** Every schema migration is validated in CI against empty MySQL 8.0 (`ci.yml` `migrations` job, including idempotency re-run) and applied to `toothcare_staging` during staging deployment.
2. **Mandatory Production Pre-Migration Backup:** Before touching the production schema, `deploy.sh` executes `backup.php --type=pre-migration` inside `db-backup` to generate an encrypted AES-256-GCM snapshot + SHA-256 manifest.
3. **Dedicated Migration Identity:** `deploy.sh` runs `database/migrate.php` in an ephemeral container using `MIGRATION_DB_USER` / `MIGRATION_DB_PASSWORD` so ordinary PHP runtime containers never require DDL privileges (`ALTER`/`CREATE`/`DROP`).
4. **Compatibility Rules:** Prefer backward-compatible (expand-and-contract) migrations; never reset databases, delete persistent volumes, or silently drop clinical/appointment history tables.
