#!/usr/bin/env bash
# =============================================================================
# ToothCare Hub — Post-Deployment Health & Smoke Verification Script (Phase 21)
# Usage:
#   BASE_URL=https://staging.example.invalid DEPLOY_ENV=staging ./deployment/scripts/health-check.sh
# =============================================================================
set -euo pipefail

DEPLOY_ENV="${DEPLOY_ENV:-staging}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-60}"

echo "[health-check] Verifying deployment at ${BASE_URL} (env=${DEPLOY_ENV})"

wait_for_http() {
  local url="$1"
  local expected="${2:-200}"
  local elapsed=0
  while [ "${elapsed}" -lt "${MAX_WAIT_SECONDS}" ]; do
    code="$(curl -sk -o /dev/null -w '%{http_code}' "${url}" || true)"
    if [ "${code}" = "${expected}" ]; then
      echo "[health-check] PASS ${url} -> HTTP ${code}"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  echo "[health-check] FAIL ${url} expected HTTP ${expected}, got ${code:-none}" >&2
  return 1
}

# 1. Core edge & API liveness
wait_for_http "${BASE_URL}/health" 200
wait_for_http "${BASE_URL}/api/v1/health" 200

# 2. Frontend SPA root & nested route history fallback
wait_for_http "${BASE_URL}/" 200
wait_for_http "${BASE_URL}/login" 200

# 3. Public catalog & CSRF token endpoint
wait_for_http "${BASE_URL}/api/v1/auth/csrf-token" 200
wait_for_http "${BASE_URL}/api/v1/services" 200
wait_for_http "${BASE_URL}/api/v1/dentists" 200

# 4. Security edge boundary checks (internal routes & metrics MUST return 403 publicly)
wait_for_http "${BASE_URL}/api/v1/metrics" 403
wait_for_http "${BASE_URL}/api/v1/internal/realtime/tickets/verify" 403
wait_for_http "${BASE_URL}/stub_status" 403

# 5. Unauthenticated protected route check (MUST return 401)
wait_for_http "${BASE_URL}/api/v1/auth/me" 401

# 6. Optional synthetic login + realtime ticket smoke test (staging only)
if [ -n "${SMOKE_TEST_EMAIL:-}" ] && [ -n "${SMOKE_TEST_PASSWORD:-}" ]; then
  echo "[health-check] Executing authenticated synthetic smoke check..."
  COOKIE_JAR="$(mktemp)"
  trap 'rm -f "${COOKIE_JAR}"' EXIT

  CSRF="$(curl -sk -c "${COOKIE_JAR}" "${BASE_URL}/api/v1/auth/csrf-token" | sed -n 's/.*"csrf_token":"\([^"]*\)".*/\1/p')"
  LOGIN_CODE="$(curl -sk -b "${COOKIE_JAR}" -c "${COOKIE_JAR}" -o /dev/null -w '%{http_code}' \
    -X POST "${BASE_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: ${CSRF}" \
    -d "{\"email\":\"${SMOKE_TEST_EMAIL}\",\"password\":\"${SMOKE_TEST_PASSWORD}\"}")"

  if [ "${LOGIN_CODE}" != "200" ]; then
    echo "[health-check] FAIL synthetic login returned HTTP ${LOGIN_CODE}" >&2
    exit 1
  fi
  echo "[health-check] PASS synthetic login -> HTTP 200"

  ME_CODE="$(curl -sk -b "${COOKIE_JAR}" -o /dev/null -w '%{http_code}' "${BASE_URL}/api/v1/auth/me")"
  if [ "${ME_CODE}" != "200" ]; then
    echo "[health-check] FAIL /api/v1/auth/me returned HTTP ${ME_CODE}" >&2
    exit 1
  fi
  echo "[health-check] PASS /api/v1/auth/me -> HTTP 200"
fi

echo "[health-check] ALL CHECKS PASSED."
