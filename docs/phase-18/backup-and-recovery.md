# Data Backup, Recovery, and Retention Review

## 1. Existing Backup Architecture Audited

Implemented in `backend/src/Services/DatabaseBackupService.php` and scheduled via the `db-backup` service in `compose.yaml`:

- **Export Methods:** Consistent `mysqldump` (`--single-transaction`) with portable PDO SQL export fallback.
- **Compression & Encryption:** GZIP (RFC 1952) + authenticated **AES-256-GCM** encryption (`IV_LENGTH = 12`, `TAG_LENGTH = 16`).
- **Integrity Verification:** SHA-256 checksums + JSON metadata manifest per artifact.
- **Safety Controls:** Pre-restore backup (`TYPE_PRE_RESTORE`), isolated restoration verification (`testRestoreInIsolation()`), and directory permissions (`0750`).
- **Phase 18 Hardening (`F-04`):** Added `DatabaseBackupService::validateDatabaseIdentifier()` enforcing `/^[A-Za-z0-9_]{1,64}$/` to prevent SQL/CLI injection on target database names.

---

## 2. Recovery Testing Evidence

- **Automated Backup & Restore Tests:** `backend/tests/Unit/DatabaseBackupTest.php` and `backend/tests/Integration/Phase18HardeningTest.php` verify encryption/decryption round-trip, tamper detection, SHA-256 checksum validation, and database identifier injection rejection without modifying production Docker volumes (`toothcare_mysql_data`).
- **Live MySQL Production-Host Restore Drill:** **NOT VERIFIED** on a live production server in this local sandbox. Before production go-live, an authorized operator must run an isolated restore drill against a dedicated staging MySQL 8.0 instance using `testRestoreInIsolation()` and record actual restore duration.

---

## 3. Operational Targets & Gaps (Pending Institutional Approval)

- **Proposed Targets (Not Yet Approved/SLA-Certified):** Daily automated encrypted backups; proposed RPO <= 24 hours, proposed RTO <= 2 hours (must be validated in staging).
- **Off-Site Storage:** Production deployments must sync encrypted `backups/` artifacts to an off-site, access-controlled, immutable object store with encryption keys stored separately from backup files.
- **Separation:** Never copy production backups into local developer machines or CI environments.
