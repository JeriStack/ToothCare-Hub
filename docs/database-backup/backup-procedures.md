# ToothCare Hub — Database Backup Operational Procedures

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document:** Backup Operational Procedures  
**Version:** 1.0.0-Production  

---

## 1. Overview of Backup Operations

ToothCare Hub provides dedicated CLI entrypoints and POSIX shell scripts for all backup operations located in `database/scripts/`:

| Script | Purpose | Output Location |
|---|---|---|
| `backup.php` / `backup.sh` | Main backup CLI for manual and daily automated runs | `backups/manual/` or `backups/daily/` |
| `pre-migration-backup.php` / `.sh` | Pre-migration snapshot before schema changes | `backups/pre-migration/` |
| `verify-backup.php` / `verify-backup.sh` | Cryptographic and structural verification | `backups/verification/` |
| `restore.php` / `restore.sh` | Database restoration engine | `backups/pre-restore/` (safeguard) |
| `cleanup-backups.php` / `.sh` | 30-day retention pruning | `backups/logs/backup.log` |

---

## 2. Manual On-Demand Backups

Administrators and operators can trigger an ad-hoc backup prior to configuration updates, major deployments, or administrative maintenance.

### 2.1 Basic Manual Backup

Using the PHP CLI runner:
```bash
php database/scripts/backup.php --type=manual --description="Pre-deployment check"
```

Using the POSIX shell wrapper:
```bash
./database/scripts/backup.sh --type=manual --description="Pre-deployment check"
```

### 2.2 CLI Arguments & Options

| Option | Default | Description |
|---|---|---|
| `--type=<daily\|manual\|pre-migration>` | `manual` | Category of backup and target subfolder |
| `--description="<text>"` | `""` | Informational note saved into the `.backup-meta.json` manifest |
| `--no-encrypt` | `false` | Bypasses encryption (creates plaintext `.sql.gz` — **not recommended in production**) |
| `--storage-path=<dir>` | `backups` | Custom root storage directory |
| `--help` / `-h` | — | Displays command-line help |

### 2.3 Example Output

```text
================================================================================
 ToothCare Hub — Database Backup Engine
================================================================================
[2026-11-07 02:00:01] Initializing database export...
[2026-11-07 02:00:01] Database: toothcare_hub (Host: 127.0.0.1:3306)
[2026-11-07 02:00:02] Export completed: 18 tables, 4,821,490 bytes
[2026-11-07 02:00:02] Applying GZIP compression (Level 9)...
[2026-11-07 02:00:02] Compressed size: 684,120 bytes (85.8% reduction)
[2026-11-07 02:00:02] Encrypting with AES-256-GCM (IV: 12 bytes, Tag: 16 bytes)...
[2026-11-07 02:00:03] Encrypted file written: backups/manual/toothcare_hub_manual_20261107_020001_a9f1b2.sql.gz.enc
[2026-11-07 02:00:03] Generating SHA-256 checksum: backups/manual/toothcare_hub_manual_20261107_020001_a9f1b2.sql.gz.enc.sha256
[2026-11-07 02:00:03] Generating metadata manifest: backups/manual/toothcare_hub_manual_20261107_020001_a9f1b2.sql.gz.enc.backup-meta.json
================================================================================
 SUCCESS: Backup created successfully!
 ID: toothcare_hub_manual_20261107_020001_a9f1b2
 Size: 684,148 bytes
 SHA-256: 7d8f4e2b01ac839f...
================================================================================
```

---

## 3. Automated Daily Backups

Automated backups run on a scheduled cadence (default: **2:00 AM daily**).

### 3.1 Executing Scheduled Daily Backup

```bash
php database/scripts/backup.php --type=daily --description="Scheduled daily full backup"
```

In the Docker Compose environment, the `db-backup` container executes this automatically via its internal cron scheduler.

### 3.2 Output Artifacts

For each backup operation, three files are generated:

1. **Backup Archive** (`.sql.gz.enc`):
   - Format: `toothcare_hub_{type}_{YYYYMMDD_HHMMSS}_{hash}.sql.gz.enc`
   - Contains: Level 9 GZIP compressed SQL dump encrypted with `AES-256-GCM`.
2. **Checksum File** (`.sha256`):
   - Standard format: `<sha256_hash>  <filename>`
   - Compatible with `sha256sum -c`.
3. **Metadata Manifest** (`.backup-meta.json`):
   - Stores operational context:
     ```json
     {
       "backup_id": "toothcare_hub_daily_20261107_020000_c8e412",
       "database_name": "toothcare_hub",
       "type": "daily",
       "created_at": "2026-11-07T02:00:00+00:00",
       "table_count": 18,
       "raw_size_bytes": 4821490,
       "compressed_size_bytes": 684120,
       "final_size_bytes": 684148,
       "compressed": true,
       "encrypted": true,
       "compression_algorithm": "gzip",
       "encryption_algorithm": "AES-256-GCM",
       "sha256_checksum": "7d8f4e2b01ac839fe4239bb7...",
       "hostname": "toothcare-web-1",
       "description": "Scheduled daily full backup"
     }
     ```

---

## 4. Pre-Migration Backups

Before any database migration runs, ToothCare Hub automatically takes a pre-migration snapshot.

### 4.1 Automated Execution via `database/migrate.php`

When running migrations:
```bash
php database/migrate.php
```
The migration runner automatically calls `DatabaseBackupService::createBackup('pre-migration', ...)` before executing any SQL migration scripts. If the backup fails, the migration halts immediately, protecting the database state.

### 4.2 Manual Pre-Migration Snapshot

To manually create a pre-migration backup before applying custom SQL scripts:
```bash
php database/scripts/pre-migration-backup.php --version="v1.0.4-patch"
```

Artifacts are stored in `backups/pre-migration/` and are protected against automated retention pruning.

---

## 5. Listing Available Backups

To inspect all available backups across all categories:

```bash
php -r "
require 'backend/vendor/autoload.php';
\$service = new App\Services\DatabaseBackupService(['storage_path' => 'backups']);
\$backups = \$service->listBackups();
foreach (\$backups as \$b) {
    echo sprintf('%-12s | %-45s | %-8s | %s\n', \$b['type'], \$b['backup_id'], number_format(\$b['final_size_bytes']).' B', \$b['created_at']);
}
"
```
