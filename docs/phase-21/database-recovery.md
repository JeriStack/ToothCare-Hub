# Database Recovery & Schema Rollback Procedure (Separate from App Rollback)

> **Critical Policy:** Do **NOT** restore the entire database simply because an application release failed. First verify whether the previous application image runs safely against the current backward-compatible schema. Full database restoration incurs a Recovery Point Objective (RPO) data-loss window and requires explicit leadership/DPO approval in production.

## 1. Pre-Migration Backup Verification

- `deployment/scripts/deploy.sh` creates an encrypted AES-256-GCM pre-migration backup (`backups/pre-migration/*.sql.gz.enc` + SHA-256 manifest) before production migrations.
- Verify integrity before any restore:
  ```bash
  docker compose -f compose.yaml -f compose.prod.yaml exec -T db-backup \
    php /var/www/backend/database/scripts/verify-backup.php --file=/var/www/backups/pre-migration/<file>
  ```

## 2. Controlled Database Restoration Steps

1. Put Nginx in maintenance mode or stop write traffic (`php-fpm`, `email-worker`, `realtime-worker`, `reminder-scheduler`).
2. Take a safety snapshot (`--type=pre-restore`) of the current database state before overwriting anything.
3. Test the target backup in an isolated database first via `DatabaseBackupService::testRestoreInIsolation()` (never delete `toothcare_mysql_data`).
4. Restore the verified backup into the target database using the privileged backup/migration account and verify table counts and sample records.
5. Restart application containers, run `deployment/scripts/health-check.sh`, and record any RPO data gap in the incident report.
