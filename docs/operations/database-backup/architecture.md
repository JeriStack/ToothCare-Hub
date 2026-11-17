# ToothCare Hub — Database Backup & Disaster Recovery Architecture

**System:** ToothCare Hub — Dental Appointment and Clinic Management System  
**Component:** Database Backup & Disaster Recovery Subsystem  
**Engine:** MySQL 8.0 / InnoDB / Native PHP 8.5  
**Version:** 1.0.0-Production  

---

## 1. Overview & Objectives

ToothCare Hub stores sensitive Patient Health Information (PHI), medical records, appointment schedules, dentist shifts, and user credentials. The database backup and disaster recovery subsystem protects this data against:

- Accidental database or table deletion.
- Malicious tampering or ransomware.
- Failed schema migrations.
- Hardware, storage, or Docker volume failures.
- Application bugs or data corruption.

---

## 2. Layered Backup Architecture

```
                    TOOTHCARE HUB
                          │
                          ▼
               MySQL / InnoDB Database
                    (toothcare_hub)
                          │
                          ▼
                  Backup Management
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Daily Backup     Manual Backup     Pre-Migration
  (2:00 AM Cron)      (CLI Tool)     (migrate.php)
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
                 mysqldump Engine
           (--single-transaction --hex-blob
             --routines --triggers --events)
                          │
                          ▼
                 GZIP Compression
                    (RFC 1952)
                          │
                          ▼
              AES-256-GCM Encryption
           (12-byte IV + 16-byte Tag)
                          │
                          ▼
             Integrity Verification
             (SHA-256 + Metadata Manifest)
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
   Local Storage                    Off-site Storage
  (30-day retention)                (S3 / Remote Server)
        │                                   │
        └─────────────────┬─────────────────┘
                          │
                          ▼
              Restoration Testing
             (Isolated Sandbox Test)
                          │
                          ▼
               Disaster Recovery
```

---

## 3. Core Architectural Components

### 3.1 Consistent Logical Dump Engine
- Executes consistent non-blocking dumps using `mysqldump` with `--single-transaction`, `--routines`, `--triggers`, `--events`, and `--hex-blob`.
- Passwords and credentials are kept out of command-line arguments using temporary configuration option files (`--defaults-extra-file`) with `0600` permissions.
- Includes a portable fallback exporter via PHP PDO with foreign key check guards.

### 3.2 Compression Layer
- Applies level 9 GZIP compression (`RFC 1952`), reducing database storage footprint by 80–90%.

### 3.3 Authenticated Encryption Layer (AES-256-GCM)
- Authenticated symmetric encryption using modern `AES-256-GCM`.
- Produces a binary archive formatted as: `[12-byte Random IV][16-byte GCM Authentication Tag][Ciphertext]`.
- Guarantees confidentiality and immediate tamper detection before any decompression or restoration occurs.

### 3.4 Cryptographic Integrity Verification
- Generates a SHA-256 checksum companion file (`.sha256`) for every backup artifact.
- Generates a JSON metadata manifest (`.backup-meta.json`) recording backup ID, database name, table count, byte sizes, and timestamps.

### 3.5 Storage Layout
```
backups/
├── daily/          # Automated scheduled daily backups
├── manual/         # On-demand operator backups
├── pre-migration/  # Automated pre-migration snapshots
├── pre-restore/    # Automated safety snapshots taken before any restoration
├── verification/   # Isolated restore test reports
└── logs/           # Backup and restoration audit log (backup.log)
```
