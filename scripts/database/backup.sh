#!/usr/bin/env bash
# ToothCare Hub - Perform MySQL Database Backup
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/toothcare_hub_backup_${TIMESTAMP}.sql"

echo "Creating backup of toothcare_hub database..."
docker exec toothcare-mysql mysqldump -u root -proot_secure_pass --single-transaction --quick toothcare_hub > "$BACKUP_FILE"
echo "Backup created successfully at: $BACKUP_FILE"
