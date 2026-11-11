# ToothCare Hub — Point-in-Time Recovery (PITR) Guide

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Document:** Point-in-Time Recovery (PITR) Specification & Operational Guide  
**Version:** 1.0.0-Production  

---

## 1. Concept & RPO Target

While daily automated backups provide a baseline 24-hour RPO, production healthcare systems require the ability to recover up to the exact minute an accidental query or corruption occurred.

**Point-in-Time Recovery (PITR)** combines:
1. **The Most Recent Full Backup** (restores base state up to 2:00 AM).
2. **MySQL Binary Transaction Logs (`binlog`)** (replays all transactions executed between the backup timestamp and the disaster event).

This architecture achieves an **RPO of ≤ 1 Hour (down to seconds)** in production.

---

## 2. Enabling MySQL Binary Logging

In MySQL 8.0, binary logging is enabled by default. For containerized production deployments, ensure the following settings are active in MySQL configuration (`/etc/mysql/conf.d/pitr.cnf` or `compose.prod.yaml`):

```ini
[mysqld]
# Enable binary logging
server-id=1
log-bin=/var/lib/mysql/mysql-bin
binlog_format=ROW
binlog_row_image=FULL
binlog_expire_logs_seconds=604800 # 7 days retention
sync_binlog=1
```

In Docker Compose, persist binary logs within the named `db_data` volume or a dedicated `db_binlog` volume.

---

## 3. Step-by-Step Point-in-Time Recovery Procedure

### Scenario:
A clinician or administrator accidentally executes a destructive update at **14:32:10 on 2026-11-07**. The last full backup was completed at **02:00:00**.

### Step 1: Prevent Further Database Writes
Stop the web application container to halt incoming appointments:
```bash
docker compose stop web app
```

### Step 2: Flush Current Binary Log
Flush the binary log on MySQL to close the active file:
```bash
mysql -u root -p -e "FLUSH LOGS;"
```

### Step 3: Identify the Incident Position & Timestamp
Inspect the binary log around 14:32:00 using `mysqlbinlog`:
```bash
mysqlbinlog --base64-output=DECODE-ROWS -v /var/lib/mysql/mysql-bin.000002 \
  | grep -B 5 -A 10 "DELETE FROM appointments"
```
Identify the exact end timestamp immediately prior to the destructive event (e.g. `2026-11-07 14:31:55`).

### Step 4: Restore the 2:00 AM Full Backup
Restore the full baseline backup taken that morning:
```bash
php database/scripts/restore.php \
  --file=backups/daily/toothcare_hub_daily_20261107_020000_c8e412.sql.gz.enc \
  --force
```

### Step 5: Replay Incremental Transactions
Replay all transactions from the 2:00 AM baseline up to 14:31:55 (stopping right before the accident):

```bash
mysqlbinlog \
  --database=toothcare_hub \
  --start-datetime="2026-11-07 02:00:00" \
  --stop-datetime="2026-11-07 14:31:55" \
  /var/lib/mysql/mysql-bin.000001 /var/lib/mysql/mysql-bin.000002 \
  | mysql -u toothcare_user -p toothcare_hub
```

### Step 6: Verify and Reopen
1. Query the database to ensure all records created up to 14:31:55 have been restored without the destructive event.
2. Restart application services:
   ```bash
   docker compose start web app
   ```
