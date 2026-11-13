# ToothCare Hub — Backup System Setup & Configuration Guide

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document:** Setup & Configuration Guide  
**Version:** 1.0.0-Production  

---

## 1. Prerequisites

Before deploying the backup subsystem, verify that the host or Docker container satisfies the following requirements:

| Component | Minimum Version | Required For |
|---|---|---|
| **PHP CLI** | 8.2+ (Recommended 8.5) | Executing backup, restore, and verification scripts |
| **PHP Extensions** | `pdo`, `pdo_mysql`, `openssl`, `zlib`, `json` | Database connection, AES-256-GCM encryption, GZIP compression |
| **MySQL Client Tools** | 8.0+ (`mysqldump`, `mysql`) | Consistent logical database dumping and streaming restoration |
| **OpenSSL CLI** | 1.1+ | Encryption key generation |
| **Storage** | 20 GB+ free disk space | Local retention buffer for 30 days of snapshots |

Verify PHP extensions:
```bash
php -m | grep -E "openssl|zlib|pdo_mysql|json"
```

---

## 2. Environment Configuration

The backup subsystem is configured via root `.env` and `backend/.env`.

### 2.1 Configuration Variables

Add or verify the following variables in your `.env` file:

```ini
# ============================================================================
# DATABASE BACKUP & DISASTER RECOVERY CONFIGURATION
# ============================================================================
BACKUP_STORAGE_PATH=backups
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=gzip
BACKUP_ENCRYPTION_ENABLED=true
# 32-byte hex-encoded key (64 hexadecimal characters)
BACKUP_ENCRYPTION_KEY=
BACKUP_SCHEDULE_CRON="0 2 * * *"
BACKUP_OFFSITE_ENABLED=false
BACKUP_OFFSITE_PATH=
BACKUP_LOG_FILE=backups/logs/backup.log
```

### 2.2 Variable Descriptions

- **`BACKUP_STORAGE_PATH`**: Relative or absolute root directory where backups are stored (`backups/`).
- **`BACKUP_RETENTION_DAYS`**: Number of days to retain daily and manual backups before pruning (default: `30`). Pre-migration backups are permanently preserved unless explicitly removed.
- **`BACKUP_COMPRESSION`**: Compression format. Supported: `gzip` (level 9).
- **`BACKUP_ENCRYPTION_ENABLED`**: Boolean (`true`/`false`). When enabled, encrypts compressed archives using `AES-256-GCM`.
- **`BACKUP_ENCRYPTION_KEY`**: 64-character hexadecimal string representing 32 raw cryptographically random bytes (256-bit symmetric key).
- **`BACKUP_SCHEDULE_CRON`**: Cron expression for automated backups (default: `0 2 * * *`, daily at 2:00 AM).
- **`BACKUP_OFFSITE_ENABLED`**: Enables secondary off-site synchronization.
- **`BACKUP_OFFSITE_PATH`**: Secondary target directory, mounted cloud volume, or remote sync mount point.
- **`BACKUP_LOG_FILE`**: Audit and diagnostic log file (`backups/logs/backup.log`).

---

## 3. Encryption Key Generation & Management

Production backups contain sensitive Patient Health Information (PHI) and must be encrypted using `AES-256-GCM`.

### 3.1 Generating an Encryption Key

Run either of the following commands to generate a cryptographically secure 256-bit hexadecimal key:

**Using OpenSSL:**
```bash
openssl rand -hex 32
```

**Using PHP CLI:**
```bash
php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"
```

*Example output:*
```text
f3a8c19d4b6e205187ac90184e5b32f10738d9b1c20e547a618f92b45037ac81
```

Copy the 64-character string and assign it to `BACKUP_ENCRYPTION_KEY` in `.env` and `backend/.env`.

### 3.2 Key Protection & Offline Custody

> [!CAUTION]
> If the `BACKUP_ENCRYPTION_KEY` is lost, **encrypted backups cannot be decrypted or restored under any circumstances**. Store an off-site copy in an enterprise password manager (e.g. 1Password, Bitwarden, or AWS Secrets Manager).

Key security guidelines:
1. **Never commit the key to Git**: Ensure `.env` is listed in `.gitignore`.
2. **Strict File Permissions**: On Linux/Unix production servers, restrict access:
   ```bash
   chmod 0600 .env backend/.env
   chmod 0700 backups
   ```
3. **Escrow Key Separation**: Store the key separately from the backup archives (never store the key in the same directory as the backup files).

---

## 4. Docker Compose Setup

ToothCare Hub includes an automated backup daemon service (`db-backup`) configured in `compose.yaml` (with environment overlays in `compose.dev.yaml` and `compose.prod.yaml`).

### 4.1 Service Definition

```yaml
  db-backup:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: toothcare-db-backup
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DB_HOST: db
      DB_PORT: 3306
      DB_DATABASE: ${DB_DATABASE:-toothcare_hub}
      DB_USERNAME: ${DB_USERNAME:-toothcare_user}
      DB_PASSWORD: ${DB_PASSWORD}
      BACKUP_STORAGE_PATH: /backups
      BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS:-30}
      BACKUP_COMPRESSION: gzip
      BACKUP_ENCRYPTION_ENABLED: ${BACKUP_ENCRYPTION_ENABLED:-true}
      BACKUP_ENCRYPTION_KEY: ${BACKUP_ENCRYPTION_KEY}
      BACKUP_SCHEDULE_CRON: ${BACKUP_SCHEDULE_CRON:-0 2 * * *}
      BACKUP_LOG_FILE: /backups/logs/backup.log
    volumes:
      - backup_data:/backups
    networks:
      - toothcare-network
```

### 4.2 Persistent Docker Volume

Backups are saved to the named Docker volume `backup_data`, ensuring they survive container restarts, rebuilds, and updates:

```yaml
volumes:
  db_data:
  backup_data:
```

To bind mount local host storage instead of a Docker volume, update the volume mapping:
```yaml
    volumes:
      - ./backups:/backups
```

---

## 5. Host-Level Automated Scheduling (Linux Cron)

When deploying outside Docker Compose, configure a system crontab entry for the web or maintenance user:

```bash
crontab -e
```

Add the following schedule to run the full backup daily at 2:00 AM, followed by automatic retention cleanup:

```cron
# ToothCare Hub Database Backup (Daily at 2:00 AM)
0 2 * * * cd /var/www/toothcare-hub && ./database/scripts/backup.sh --type=daily >> backups/logs/cron.log 2>&1

# ToothCare Hub Backup Retention Pruning (Daily at 3:00 AM)
0 3 * * * cd /var/www/toothcare-hub && ./database/scripts/cleanup-backups.sh >> backups/logs/cron.log 2>&1
```

---

## 6. Verification of Setup

Execute the verify-backup command to ensure the backup pipeline and environment are operational:

```bash
php database/scripts/backup.php --type=manual --description="Initial setup validation"
```

Check the generated files in `backups/manual/`:
- `*.sql.gz.enc` (or `*.sql.gz` if encryption is disabled)
- `*.sha256`
- `*.backup-meta.json`

Verify the audit log:
```bash
tail -n 20 backups/logs/backup.log
```
