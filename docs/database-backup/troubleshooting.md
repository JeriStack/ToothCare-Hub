# ToothCare Hub — Backup & Disaster Recovery Troubleshooting

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document:** Troubleshooting & Diagnostic Guide  
**Version:** 1.0.0-Production  

---

## 1. Diagnostic Log Inspection

All backup, verification, restoration, and retention operations log diagnostic traces to `backups/logs/backup.log`.

To view recent activity:
```bash
tail -n 50 backups/logs/backup.log
```

To monitor backup execution in real time:
```bash
tail -f backups/logs/backup.log
```

---

## 2. Common Errors and Resolutions

### 2.1 Error: "SHA-256 checksum verification failed"

**Symptom:**
```text
RuntimeException: SHA-256 checksum mismatch for backup archive!
Expected: a8b9c...
Actual:   12d4e...
```

**Causes:**
- Incomplete download from remote cloud storage.
- File truncated during network transfer.
- Disk sector degradation or corruption.

**Resolution:**
1. Check the file size on disk vs. the size in `.backup-meta.json`:
   ```bash
   ls -l backups/daily/
   cat backups/daily/*.backup-meta.json
   ```
2. Re-download the archive from remote storage:
   ```bash
   aws s3 cp s3://toothcare-hub-backups/daily/<filename> backups/daily/
   ```
3. Run verification again:
   ```bash
   php database/scripts/verify-backup.php --file=backups/daily/<filename>
   ```

---

### 2.2 Error: "Decryption failed or invalid authentication tag"

**Symptom:**
```text
RuntimeException: AES-256-GCM decryption failed: authentication tag verification failed.
```

**Causes:**
- `BACKUP_ENCRYPTION_KEY` in `.env` does not match the key used when creating the backup.
- The ciphertext payload has been altered (tampering or bit-flip).
- The file is corrupt or truncated.

**Resolution:**
1. Confirm that `BACKUP_ENCRYPTION_KEY` is exactly 64 hexadecimal characters:
   ```bash
   php -r "echo strlen(trim(getenv('BACKUP_ENCRYPTION_KEY')));"
   ```
   *Expected output: 64*
2. Verify you are using the correct historic encryption key from your key management vault for older backups.

---

### 2.3 Error: "Encryption key must be a 64-character hexadecimal string"

**Symptom:**
```text
InvalidArgumentException: Backup encryption key must be a 64-character hexadecimal string (32 bytes).
```

**Resolution:**
The system requires a 256-bit symmetric key formatted as 64 hex characters. Generate one with:
```bash
openssl rand -hex 32
```
And paste it into `.env` under `BACKUP_ENCRYPTION_KEY`.

---

### 2.4 Error: "mysqldump: command not found"

**Symptom:**
```text
Warning: mysqldump utility not found in system PATH. Falling back to PDO export engine.
```

**Explanation & Resolution:**
ToothCare Hub includes an automated fallback PDO export engine that executes if `mysqldump` is unavailable. However, for maximum performance and database feature support in production, install `mysql-client`:
```bash
# Ubuntu / Debian
apt-get update && apt-get install -y mysql-client

# Alpine (Docker)
apk add --no-cache mysql-client
```

---

### 2.5 Error: "No space left on device" (Disk Exhaustion)

**Symptom:**
```text
Warning: file_put_contents(): Only 0 of 524288 bytes written, possibly out of free disk space
```

**Resolution:**
1. Check available disk space:
   ```bash
   df -h
   ```
2. Run dry-run cleanup to inspect what can be safely pruned:
   ```bash
   php database/scripts/cleanup-backups.php --dry-run --retention-days=14
   ```
3. Execute cleanup:
   ```bash
   php database/scripts/cleanup-backups.php --retention-days=14
   ```
4. Move older backups to cold off-site storage.

---

### 2.6 Error: "Lock wait timeout exceeded" during backup

**Causes:**
Long-running transactions holding table locks while `mysqldump` is initializing.

**Resolution:**
`DatabaseBackupService` defaults to `--single-transaction`, which guarantees InnoDB consistency without locking tables. Ensure all tables use the `InnoDB` storage engine:
```bash
mysql -u toothcare_user -p toothcare_hub -e "SELECT table_name, engine FROM information_schema.tables WHERE table_schema='toothcare_hub';"
```
If any table uses `MyISAM`, convert it to `InnoDB`:
```sql
ALTER TABLE table_name ENGINE=InnoDB;
```
