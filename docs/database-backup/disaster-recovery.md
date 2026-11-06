# ToothCare Hub — Disaster Recovery Plan & Playbooks

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document:** Disaster Recovery Plan & Operational Playbooks  
**Version:** 1.0.0-Production  

---

## 1. Recovery Objectives (RPO & RTO)

| Environment | Recovery Point Objective (RPO) | Recovery Time Objective (RTO) |
|---|---|---|
| **Production** | **≤ 1 Hour** (with Binary Logging enabled)<br>**≤ 24 Hours** (Full Daily Snapshots) | **≤ 2 Hours** |
| **Staging / Development** | **≤ 24 Hours** | **≤ 4 Hours** |

- **RPO (Recovery Point Objective)**: Maximum acceptable age of data lost following an unplanned interruption.
- **RTO (Recovery Time Objective)**: Maximum acceptable duration of downtime before clinical operations are restored.

---

## 2. Emergency Incident Response Workflow

```
[Disaster Detected]
        │
        ▼
[1. Declare Severity & Freeze Operations]
        │
        ▼
[2. Identify Incident Scenario (A, B, C, D, or E)]
        │
        ▼
[3. Assess Latest Valid Backup & Checksum]
        │
        ▼
[4. Execute Isolated Test Restore (--test-restore)]
        │
        ▼
[5. Execute Production Database Restoration]
        │
        ▼
[6. Verify Clinical Integrity & Application Health]
        │
        ▼
[7. Resume Clinic Operations & Post-Mortem]
```

---

## 3. Incident Playbooks by Scenario

### Scenario A: Accidental Table or Record Deletion

**Trigger:** An operator accidentally runs `DROP TABLE appointments;` or a batch deletion without a `WHERE` clause.

**Action Steps:**
1. Put web server into maintenance mode:
   ```bash
   touch backend/storage/maintenance.flag
   ```
2. Verify the latest daily or manual backup:
   ```bash
   php database/scripts/verify-backup.php --file=backups/daily/latest.sql.gz.enc
   ```
3. Execute restore with automatic pre-restore safeguard:
   ```bash
   php database/scripts/restore.php --file=backups/daily/latest.sql.gz.enc --force
   ```
4. Verify record counts:
   ```bash
   mysql -u toothcare_user -p toothcare_hub -e "SELECT count(*) FROM appointments;"
   ```
5. Remove maintenance mode and notify clinic staff.

---

### Scenario B: Failed Database Migration

**Trigger:** `php database/migrate.php` fails halfway through applying schema changes.

**Action Steps:**
1. Locate the automatic pre-migration snapshot created right before the failure:
   ```bash
   ls -lt backups/pre-migration/
   ```
2. Restore the pre-migration snapshot:
   ```bash
   php database/scripts/restore.php \
     --file=backups/pre-migration/toothcare_hub_pre_migration_*.sql.gz.enc \
     --force \
     --skip-pre-restore-backup
   ```
3. Review `database/migrations/` logs and fix the SQL syntax before retrying.

---

### Scenario C: Docker Container or Named Volume Loss

**Trigger:** Docker host error or accidental `docker volume rm db_data`.

**Action Steps:**
1. Re-initialize Docker containers:
   ```bash
   docker compose down
   docker compose up -d db
   ```
2. Wait for MySQL to become healthy (`docker compose ps`).
3. Restore from the persistent backup volume or host storage:
   ```bash
   docker compose run --rm db-backup \
     php /var/www/toothcare-hub/database/scripts/restore.php \
     --file=/backups/daily/latest.sql.gz.enc \
     --force \
     --skip-pre-restore-backup
   ```
4. Start the application services:
   ```bash
   docker compose up -d web app realtime
   ```

---

### Scenario D: Total Server or Infrastructure Failure (Bare-Metal Rebuild)

**Trigger:** Cloud VM termination, catastrophic disk crash, or hardware destruction.

**Action Steps:**
1. Provision a new server instance with Docker and Git installed.
2. Clone repository:
   ```bash
   git clone https://github.com/organization/ToothCare-Hub.git /var/www/toothcare-hub
   cd /var/www/toothcare-hub
   ```
3. Retrieve `.env` and `BACKUP_ENCRYPTION_KEY` from password vault.
4. Retrieve the latest off-site backup archive and `.sha256` from remote storage:
   ```bash
   aws s3 sync s3://toothcare-hub-backups/daily/ ./backups/daily/
   ```
5. Verify integrity:
   ```bash
   php database/scripts/verify-backup.php --file=backups/daily/toothcare_hub_daily_...sql.gz.enc
   ```
6. Start MySQL:
   ```bash
   docker compose up -d db
   ```
7. Restore database:
   ```bash
   php database/scripts/restore.php --file=backups/daily/toothcare_hub_daily_...sql.gz.enc --force --skip-pre-restore-backup
   ```
8. Start full system:
   ```bash
   docker compose up -d
   ```

---

### Scenario E: Ransomware or Cryptographic Tampering

**Trigger:** Host compromised, files modified or encrypted by unauthorized third party.

**Action Steps:**
1. Immediately isolate the host from the network.
2. Spin up a new clean environment.
3. Retrieve clean backup archives from immutable write-once (WORM) off-site cloud storage.
4. Run verification:
   ```bash
   php database/scripts/verify-backup.php --file=backups/daily/latest.sql.gz.enc
   ```
   *If the archive was tampered with, OpenSSL GCM tag verification will immediately fail and block execution.*
5. Restore from the verified immutable backup into the clean environment.

---

## 4. Disaster Recovery Testing Cadence

To guarantee that disaster recovery works under pressure:
- **Monthly**: Run an isolated test restoration (`php database/scripts/restore.php --file=... --test-restore`) via automated cron or CI.
- **Bi-Annually**: Conduct a full tabletop simulation restoring onto a secondary staging server.
