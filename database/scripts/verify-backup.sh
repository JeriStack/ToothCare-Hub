#!/bin/sh
# ToothCare Hub - Backup Verification Wrapper
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

php "${SCRIPT_DIR}/verify-backup.php" "$@"
