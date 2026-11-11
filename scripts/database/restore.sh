#!/usr/bin/env bash
# ToothCare Hub - Restore MySQL Database from Backup
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: ./scripts/database/restore.sh <path-to-sql-backup>"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found at $BACKUP_FILE"
    exit 1
fi

echo "Restoring database from $BACKUP_FILE..."
docker exec -i toothcare-mysql mysql -u root -proot_secure_pass toothcare_hub < "$BACKUP_FILE"
echo "Database restored successfully!"
