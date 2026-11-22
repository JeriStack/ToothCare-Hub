# Application Image Rollback Procedure (Phase 21)

Application rollback reverts **only container images** to the previous known-good immutable tag/digest recorded in `.last_known_good_release`. It **never rebuilds source code** and **never deletes volumes or automatically restores the database**.

## Automated Rollback Command

```bash
# Staging rollback (reads .last_known_good_release automatically, or pass explicit tag)
DEPLOY_ENV=staging IMAGE_REGISTRY=ghcr.io/<owner> \
  bash deployment/scripts/rollback.sh [previous-known-good-tag]

# Production rollback
DEPLOY_ENV=production IMAGE_REGISTRY=ghcr.io/<owner> \
  bash deployment/scripts/rollback.sh <previous-known-good-tag>
```

## Verification Steps

1. Confirm `.current_release` updated and `docker compose ps` reports all containers `healthy`.
2. Confirm `deployment/scripts/health-check.sh` passed all HTTP, SPA, and `403` edge checks.
3. Inspect Prometheus/Grafana dashboards and `docker compose logs --tail=100` to confirm error rates returned to baseline.
4. Record the incident and root cause before attempting a forward fix.
