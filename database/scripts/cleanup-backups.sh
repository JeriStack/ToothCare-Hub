#!/bin/sh
# ToothCare Hub - Backup Retention Cleanup Wrapper
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

php "${SCRIPT_DIR}/cleanup-backups.php" "$@"
