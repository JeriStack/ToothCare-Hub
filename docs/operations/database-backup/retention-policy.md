# ToothCare Hub — Database Backup Retention Policy

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document:** Backup Retention Policy  
**Version:** 1.0.0-Production  

---

## 1. Retention Objectives & Standards

The ToothCare Hub retention policy balances two priorities:
1. **Clinical & Legal Recoverability**: Retains sufficient point-in-time recovery points to address historical discrepancies, audits, or accidental data deletions that are discovered weeks after occurrence.
2. **Storage Footprint Management**: Prevents disk exhaustion on production servers by pruning older daily snapshots.

---

## 2. Retention Schedule Matrix

As defined in the ToothCare Hub Database Protection specification:

| Backup Category | Retention Period | Automatic Cleanup | Override / Exemption |
|---|---|---|---|
| **Daily Backups (`daily/`)** | **30 Days** | Yes (automatic cron) | None |
| **Manual Backups (`manual/`)** | **30 Days** | Yes (automatic cron) | Files tagged `--pin` or moved to cold archive |
| **Pre-Migration (`pre-migration/`)** | **Permanent (Indefinite)** | **NO** | Never pruned by automated retention |
| **Pre-Restore (`pre-restore/`)** | **14 Days** | Yes | Preserves immediate rollback safety net |
| **Off-Site Backups** | **90 Days / 1 Year** | Configurable via S3 Lifecycle | Archived to cold storage (Glacier / Nearline) |

---

## 3. Pruning Rules & Exemption Safeguards

The cleanup engine in `DatabaseBackupService::cleanupBackups()` enforces the following rules:

1. **Pre-Migration Invariance**: Backups located in `backups/pre-migration/` or containing `pre_migration` in their filename are **never deleted** by automatic retention routines.
2. **Companion Cleanup**: When a backup file (`.sql.gz.enc`) is pruned, its matching `.sha256` checksum and `.backup-meta.json` manifest are deleted together, ensuring no orphan metadata remains.
3. **Safety Threshold**: The cleanup engine verifies that at least one valid, uncorrupted backup remains before pruning older files.

---

## 4. Operational Pruning Commands

### 4.1 Dry-Run Mode (Simulation)

Always simulate pruning before executing permanent deletions to audit which files will be removed:

Using PHP CLI:
```bash
php database/scripts/cleanup-backups.php --dry-run --retention-days=30
```

Using POSIX shell wrapper:
```bash
./database/scripts/cleanup-backups.sh --dry-run --retention-days=30
```

*Example Dry-Run Output:*
```text
================================================================================
 ToothCare Hub — Backup Retention Pruning Engine (DRY RUN)
================================================================================
[2026-11-07 03:00:01] Scanning backups in: backups/
[2026-11-07 03:00:01] Retention cutoff: 30 days (before 2026-10-08 03:00:01)
[2026-11-07 03:00:01] Total backups found: 38
[2026-11-07 03:00:01] [DRY RUN] Would prune: backups/daily/toothcare_hub_daily_20261005_020000_12ab34.sql.gz.enc (Age: 33 days)
[2026-11-07 03:00:01] [DRY RUN] Would prune: backups/daily/toothcare_hub_daily_20261006_020000_56cd78.sql.gz.enc (Age: 32 days)
[2026-11-07 03:00:01] [DRY RUN] Would prune: backups/daily/toothcare_hub_daily_20261007_020000_90ef12.sql.gz.enc (Age: 31 days)
[2026-11-07 03:00:01] Protected pre-migration backups: 4 skipped
[2026-11-07 03:00:01] [DRY RUN] Summary: 3 files would be deleted, freeing ~2.1 MB. No files were removed.
================================================================================
```

### 4.2 Executing Actual Retention Cleanup

To execute actual deletion:
```bash
php database/scripts/cleanup-backups.php --retention-days=30
```

---

## 5. Automated Retention Scheduling

In production, cleanup runs daily at **3:00 AM** (1 hour after the 2:00 AM full backup):

### Via System Cron:
```cron
0 3 * * * cd /var/www/toothcare-hub && ./database/scripts/cleanup-backups.sh >> backups/logs/cron.log 2>&1
```

### Via Docker Compose:
The `db-backup` container handles retention cleanup following scheduled backups automatically.

---

## 6. Capacity Planning & Disk Space Calculations

For an active dental clinic database:

| Metric | Estimated Value |
|---|---|
| Raw database size (10,000 appointments + PHI) | ~25 MB |
| Compressed & encrypted archive size (85% ratio) | ~3.8 MB |
| Daily snapshots (30 days) | 30 × 3.8 MB = **~114 MB** |
| Pre-migration snapshots (annual estimate) | 20 × 3.8 MB = **~76 MB** |
| Pre-restore snapshots (14-day rolling) | 5 × 3.8 MB = **~19 MB** |
| **Total 30-Day Storage Footprint** | **< 250 MB** |

Even with rapid growth to 100,000+ records, 30 days of retention requires less than 2.5 GB of disk space.
