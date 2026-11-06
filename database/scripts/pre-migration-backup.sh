#!/bin/sh
# ToothCare Hub - Pre-Migration Backup Wrapper
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

php "${SCRIPT_DIR}/pre-migration-backup.php" "$@"
