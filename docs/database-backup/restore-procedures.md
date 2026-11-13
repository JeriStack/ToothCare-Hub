# ToothCare Hub — Database Restoration Procedures

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document:** Database Restoration Procedures  
**Version:** 1.0.0-Production  

---

## 1. Restoration Safety Principles

Restoring a database replaces live clinic tables and Patient Health Information (PHI). ToothCare Hub implements strict safeguards:

1. **Pre-Restore Safety Snapshot**: Before modifying or dropping any live tables, the restoration engine automatically takes a full backup of the live database into `backups/pre-restore/`. If the restore fails or is cancelled, the prior state can be recovered immediately.
2. **Cryptographic Checksum Verification**: The backup archive's SHA-256 checksum is calculated and matched against the companion `.sha256` file before any data is sent to MySQL.
3. **Authenticated Decryption (GCM Tag Verification)**: The 16-byte `AES-256-GCM` tag is verified by OpenSSL. Any data corruption or key mismatch fails before execution starts.
4. **Foreign Key Integrity**: Restoration disables foreign key checks during the table drop/recreation phase and reenables them upon completion.
5. **Interactive Confirmation**: In interactive terminals, the operator must type `RESTORE` to proceed.

---

## 2. Standard Database Restoration

### 2.1 Interactive Restoration

To restore a specific backup file:

Using PHP CLI:
```bash
php database/scripts/restore.php --file=backups/daily/toothcare_hub_daily_20261107_020000_c8e412.sql.gz.enc
```

Using POSIX shell wrapper:
```bash
./database/scripts/restore.sh --file=backups/daily/toothcare_hub_daily_20261107_020000_c8e412.sql.gz.enc
```

*Interactive Prompt:*
```text
================================================================================
 WARNING: RESTORING WILL OVERWRITE ALL EXISTING TABLES IN DATABASE: toothcare_hub
================================================================================
A safety pre-restore backup will be created in backups/pre-restore/.
Type 'RESTORE' to confirm: RESTORE
```

### 2.2 Unattended / Automated Restoration (`--force`)

For automated failovers or disaster recovery automation, pass `--force`:

```bash
php database/scripts/restore.php \
  --file=backups/daily/toothcare_hub_daily_20261107_020000_c8e412.sql.gz.enc \
  --force
```

### 2.3 CLI Options Reference

| Option | Description |
|---|---|
| `--file=<path>` | Path to the `.sql.gz.enc` or `.sql.gz` archive to restore (**Required**) |
| `--force` | Bypasses interactive confirmation |
| `--test-restore` | Restores into an isolated temporary database (`toothcare_restore_test_*`) without touching the live database |
| `--skip-pre-restore-backup` | Skips creating the safety snapshot in `backups/pre-restore/` (**Caution!**) |
| `--target-db=<name>` | Overrides the target database name |
| `--help` / `-h` | Displays usage instructions |

---

## 3. Isolated Sandbox Restoration Testing (`--test-restore`)

To test the integrity of a backup without risking production data, use `--test-restore`.

```bash
php database/scripts/restore.php \
  --file=backups/daily/toothcare_hub_daily_20261107_020000_c8e412.sql.gz.enc \
  --test-restore
```

### 3.1 Test Restoration Lifecycle

1. Creates an isolated temporary database (e.g. `toothcare_test_restore_672b1a8f`).
2. Decrypts and decompresses the backup artifact in memory.
3. Streams the schema and data into the temporary database.
4. Queries the temporary database to count imported tables and row counts.
5. Validates that core clinical tables exist:
   - `users`, `patients`, `dentists`, `appointments`, `services`, `schedules`
6. Drops the temporary test database, leaving no persistent artifacts.
7. Logs the test result to `backups/logs/backup.log`.

---

## 4. Post-Restoration Verification Checklist

Following any restoration, execute the following post-flight verification steps:

1. **Verify Table Count**:
   ```bash
   mysql -u toothcare_user -p toothcare_hub -e "SELECT count(*) AS total_tables FROM information_schema.tables WHERE table_schema='toothcare_hub';"
   ```
   *Expected count:* 18 core tables.

2. **Verify Record Counts & Foreign Key Consistency**:
   ```bash
   mysql -u toothcare_user -p toothcare_hub -e "
     SELECT 'users' AS tbl, count(*) FROM users UNION ALL
     SELECT 'patients', count(*) FROM patients UNION ALL
     SELECT 'dentists', count(*) FROM dentists UNION ALL
     SELECT 'appointments', count(*) FROM appointments;
   "
   ```

3. **Check Application Health**:
   ```bash
   curl -I http://localhost:8000/api/v1/health
   ```

4. **Verify Frontend Connectivity**:
   Open `http://localhost:5173/` in your browser and confirm login and appointments load accurately.

---

## 5. Emergency Rollback

If a restoration was executed in error or contains incomplete data, immediately roll back to the pre-restore safety snapshot:

1. Locate the latest pre-restore snapshot:
   ```bash
   ls -lt backups/pre-restore/
   ```
2. Restore the safety snapshot:
   ```bash
   php database/scripts/restore.php \
     --file=backups/pre-restore/toothcare_hub_pre_restore_20261107_...sql.gz.enc \
     --force \
     --skip-pre-restore-backup
   ```
