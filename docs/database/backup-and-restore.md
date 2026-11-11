# ToothCare Hub — Database Backup and Disaster Recovery Runbook

## 1. Overview
ToothCare Hub implements automated and on-demand database backup strategies to prevent accidental data loss and guarantee recovery Point-in-Time Objectives (RPO < 24h, RTO < 15m).

---

## 2. Automated Backups (Docker Daemon)
The `toothcare-db-backup` container runs continuously in the Docker Compose topology:
- Schedule: 2:00 AM Daily
- Target: `/var/www/backups/toothcare_hub_daily_YYYYMMDD.sql.gz`
- Retention: 30 days (older backups automatically pruned)

---

## 3. On-Demand Backups

### Creating a manual backup via PowerShell:
```powershell
.\scripts\database\backup.ps1 -BackupDir backups
```

### Creating a manual backup via Bash:
```bash
./scripts/database/backup.sh
```

### Direct Docker command:
```bash
docker exec toothcare-mysql mysqldump -u root -proot_secure_pass --single-transaction --quick toothcare_hub > backups/manual_backup.sql
```

---

## 4. Disaster Recovery & Restoration

### Restoring from a backup via PowerShell:
```powershell
.\scripts\database\restore.ps1 -BackupFile backups\toothcare_hub_backup_20261111_010000.sql
```

### Restoring from a backup via Bash:
```bash
./scripts/database/restore.sh backups/toothcare_hub_backup_20261111_010000.sql
```

### Direct Docker command:
```bash
docker exec -i toothcare-mysql mysql -u root -proot_secure_pass toothcare_hub < backups/manual_backup.sql
```
