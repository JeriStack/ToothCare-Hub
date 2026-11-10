#!/usr/bin/env bash
# ToothCare Hub - Execute Migrations inside Docker
set -euo pipefail

echo "Executing ToothCare Hub database migrations in Docker container..."
docker exec toothcare-php-fpm php /var/www/backend/database/migrate.php "$@"
