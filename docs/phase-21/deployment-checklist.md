# Phase 21 — Release & Staging Deployment Checklist

- [ ] **Release Identity:** Commit SHA & immutable tag (`sha-<12>` or `vX.Y.Z`) recorded in `release-manifest.json` (never `latest`).
- [ ] **CI Gates:** `ci.yml` passed (PHPUnit, Vitest, Realtime, OpenAPI check/validate, MySQL 8 migrations, Composer/npm audits, `promtool`, Docker builds, `nginx -t`, Trivy `CRITICAL` scan).
- [ ] **Environment Isolation:** Staging uses `.env.staging.example`-based secrets, `toothcare_staging_*` volumes, and Mailpit SMTP sink (zero production data/emails).
- [ ] **GitHub Environments:** `staging` and protected `production` (with required reviewers) secrets configured.
- [ ] **Migrations & Backup:** Staging migrations passed; production pre-migration encrypted backup verified.
- [ ] **Edge & TLS:** HTTPS active, `/api/v1/internal/*`, `/api/v1/metrics`, and `/stub_status` return `403` publicly.
- [ ] **Smoke Tests:** `deployment/scripts/health-check.sh` passed (health, SPA fallback, CSRF, catalog, synthetic login, booking, Mailpit capture, WSS realtime).
- [ ] **Monitoring:** Prometheus targets `UP`, Grafana dashboards populated, no PII in metrics.
- [ ] **Rollback Ready:** Previous known-good tag recorded in `.last_known_good_release` and `deployment/scripts/rollback.sh` verified.
