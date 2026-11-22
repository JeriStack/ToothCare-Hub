#!/usr/bin/env bash
# =============================================================================
# ToothCare Hub — Controlled Immutable Release Deployment Script (Phase 21)
# Usage:
#   DEPLOY_ENV=staging IMAGE_REGISTRY=ghcr.io/org IMAGE_TAG=<sha> ./deployment/scripts/deploy.sh
#   DEPLOY_ENV=production IMAGE_REGISTRY=ghcr.io/org IMAGE_TAG=v1.0.0 ./deployment/scripts/deploy.sh
#
# Guarantees:
#   - Pulls pre-built immutable images (NEVER rebuilds on the target server)
#   - Records previous known-good tag for rapid rollback
#   - Requires encrypted pre-migration backup in production
#   - Preserves all persistent named volumes (never uses `down -v`)
#   - Runs post-deployment health & smoke verification
# =============================================================================
set -euo pipefail

DEPLOY_ENV="${DEPLOY_ENV:-staging}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/toothcare-hub}"
IMAGE_TAG="${IMAGE_TAG:-}"
RELEASE_LEDGER=".last_known_good_release"
CURRENT_LEDGER=".current_release"

if [ -z "${IMAGE_TAG}" ] || [ "${IMAGE_TAG}" = "latest" ]; then
  echo "ERROR: IMAGE_TAG must be an explicit commit SHA or semantic release tag (never 'latest')." >&2
  exit 1
fi

case "${DEPLOY_ENV}" in
  staging)
    COMPOSE_FILES=(-f compose.yaml -f compose.prod.yaml -f compose.staging.yaml)
    ;;
  production)
    COMPOSE_FILES=(-f compose.yaml -f compose.prod.yaml)
    ;;
  *)
    echo "ERROR: Unsupported DEPLOY_ENV '${DEPLOY_ENV}'. Use 'staging' or 'production'." >&2
    exit 1
    ;;
esac

export IMAGE_REGISTRY IMAGE_TAG

echo "[deploy] Environment: ${DEPLOY_ENV}"
echo "[deploy] Release tag: ${IMAGE_TAG}"

# Record previous known-good release tag before replacing containers
if [ -f "${CURRENT_LEDGER}" ]; then
  cp "${CURRENT_LEDGER}" "${RELEASE_LEDGER}"
  echo "[deploy] Saved previous known-good release to ${RELEASE_LEDGER}: $(cat "${RELEASE_LEDGER}")"
fi

# 1. Validate rendered Compose configuration
docker compose "${COMPOSE_FILES[@]}" config -q

# 2. Pull immutable pre-built images from registry (no server-side builds)
echo "[deploy] Pulling immutable release images..."
docker compose "${COMPOSE_FILES[@]}" pull --ignore-pull-failures

# 3. Pre-migration encrypted backup (mandatory in production)
if [ "${DEPLOY_ENV}" = "production" ]; then
  echo "[deploy] Creating mandatory pre-migration encrypted database backup..."
  docker compose "${COMPOSE_FILES[@]}" exec -T db-backup \
    php /var/www/backend/database/scripts/backup.php --type=pre-migration
fi

# 4. Run controlled database migrations using dedicated migration credentials when provided
if [ -f "database/migrate.php" ]; then
  echo "[deploy] Executing controlled database migrations..."
  MIG_USER="${MIGRATION_DB_USER:-${DB_USER:-}}"
  MIG_PASS="${MIGRATION_DB_PASSWORD:-${DB_PASSWORD:-}}"
  docker compose "${COMPOSE_FILES[@]}" run --rm \
    -e "DB_USER=${MIG_USER}" \
    -e "DB_USERNAME=${MIG_USER}" \
    -e "DB_PASSWORD=${MIG_PASS}" \
    -v "${PWD}/database:/var/www/database:ro" \
    php-fpm php /var/www/database/migrate.php --no-backup
fi

# 5. Start updated services without rebuilding and without removing volumes
echo "[deploy] Starting release containers (--no-build, preserving volumes)..."
docker compose "${COMPOSE_FILES[@]}" up -d --no-build --remove-orphans

# 6. Verify health and run smoke checks
echo "[deploy] Running post-deployment health checks..."
DEPLOY_ENV="${DEPLOY_ENV}" bash deployment/scripts/health-check.sh

echo "${IMAGE_TAG}" > "${CURRENT_LEDGER}"
echo "[deploy] Deployment of ${IMAGE_TAG} to ${DEPLOY_ENV} SUCCEEDED."
