# ToothCare Hub — Docker Database Setup & Troubleshooting Guide

## 1. Quick Start

ToothCare Hub's database runs inside Docker via the `toothcare-mysql` container.

### Start the database and backend services:
```bash
docker compose up -d
```

### Verify container health:
```bash
docker ps --filter "name=toothcare"
```

Expected status:
- `toothcare-mysql`: `Up (healthy)` on internal port `3306`
- `toothcare-php-fpm`: `Up (healthy)` on internal port `9000`
- `toothcare-nginx`: `Up (healthy)` on host port `8080`

---

## 2. Environment Variables Configuration

Create or verify `.env` in the repository root and `backend/.env`:

### Root `.env`:
```ini
DB_HOST=mysql
DB_PORT=3306
DB_NAME=toothcare_hub
DB_USER=toothcare_user
DB_USERNAME=toothcare_user
DB_PASSWORD=toothcare_secure_pass
DB_ROOT_PASSWORD=root_secure_pass
```

### `backend/.env`:
```ini
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=toothcare_hub
DB_USERNAME=toothcare_user
DB_PASSWORD=toothcare_secure_pass
DB_CHARSET=utf8mb4
DB_NAME=toothcare_hub
DB_USER=toothcare_user
```

---

## 3. Database Operations via Docker

### Run Pending Migrations:
```bash
# PowerShell
.\scripts\database\migrate.ps1

# Linux / Bash
./scripts/database/migrate.sh
```

### Check Migration Status:
```bash
docker exec toothcare-php-fpm php /var/www/backend/database/migrate.php --status
```

### Re-seed Development Data (Idempotent):
```bash
# PowerShell
.\scripts\database\seed.ps1

# Linux / Bash
./scripts/database/seed.sh
```

### Run Full Database Integrity Test Suite:
```bash
docker exec toothcare-php-fpm php /var/www/backend/database/tests/run_tests.php
```

---

## 4. Troubleshooting Common Issues

### Issue 1: "Sign in failed: Invalid email or password" or 503 Service Unavailable
**Root Cause**: Mismatch between `DB_PASSWORD` or `DB_USER` in `.env` and MySQL container user permissions.  
**Resolution**:
1. Confirm credentials match `toothcare_user` / `toothcare_secure_pass`.
2. Connect to container to verify:
   ```bash
   docker exec -it toothcare-mysql mysql -u toothcare_user -ptoothcare_secure_pass toothcare_hub -e "SELECT 1;"
   ```

### Issue 2: Frontend chunk size warning on `npm run build`
**Resolution**: `frontend/vite.config.js` is configured with Rollup `manualChunks` (`vendor-react`, `vendor-icons`) and `chunkSizeWarningLimit: 1000`. The production bundle builds under 450 kB with 0 warnings.
