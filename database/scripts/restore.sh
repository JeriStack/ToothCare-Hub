#!/bin/sh
# ToothCare Hub - Database Restoration Wrapper
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

php "${SCRIPT_DIR}/restore.php" "$@"
