#!/usr/bin/env bash
# =============================================================================
# ToothCare Hub — Application Image Rollback Script (Phase 21)
# Usage:
#   DEPLOY_ENV=staging ./deployment/scripts/rollback.sh [previous-image-tag]
#
# Safety Rules:
#   - Rolls back ONLY container images to a previously tested immutable tag/digest
#   - NEVER rebuilds older source code during an incident
#   - NEVER deletes persistent Docker volumes or automatically restores the database
#   - Database recovery is a separate governed procedure (docs/phase-21/database-recovery.md)
# =============================================================================
set -euo pipefail

DEPLOY_ENV="${DEPLOY_ENV:-staging}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io/toothcare-hub}"
RELEASE_LEDGER=".last_known_good_release"
CURRENT_LEDGER=".current_release"

TARGET_TAG="${1:-}"
if [ -z "${TARGET_TAG}" ] && [ -f "${RELEASE_LEDGER}" ]; then
  TARGET_TAG="$(cat "${RELEASE_LEDGER}")"
fi

if [ -z "${TARGET_TAG}" ] || [ "${TARGET_TAG}" = "latest" ]; then
  echo "ERROR: Provide a known-good previous IMAGE_TAG or ensure ${RELEASE_LEDGER} exists." >&2
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
    echo "ERROR: Unsupported DEPLOY_ENV '${DEPLOY_ENV}'." >&2
    exit 1
    ;;
esac

export IMAGE_REGISTRY
export IMAGE_TAG="${TARGET_TAG}"

echo "[rollback] Rolling back ${DEPLOY_ENV} application containers to known-good tag: ${TARGET_TAG}"
echo "[rollback] Database schema and persistent volumes will NOT be modified or deleted."

docker compose "${COMPOSE_FILES[@]}" pull --ignore-pull-failures
docker compose "${COMPOSE_FILES[@]}" up -d --no-build --remove-orphans

echo "[rollback] Verifying service health after rollback..."
DEPLOY_ENV="${DEPLOY_ENV}" bash deployment/scripts/health-check.sh

echo "${TARGET_TAG}" > "${CURRENT_LEDGER}"
echo "[rollback] Application rollback to ${TARGET_TAG} SUCCEEDED."
