# Phase 21 — Secret Management & GitHub Environments

## 1. GitHub Actions Environments

Configure two separate GitHub Environments in repository **Settings → Environments**:

| Environment | Protection Rules | Required Secrets |
|---|---|---|
| `staging` | Branch/tag policy (`staging`, `develop`, `v*`) | `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`, `STAGING_APP_DIR` |
| `production` | **Required reviewers (manual approval)**, `main`/release tags only | `PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_SSH_KEY`, `PROD_APP_DIR` |

## 2. Host Runtime Secrets Separation

- Staging secrets live only in `/opt/toothcare-staging/.env` (`chmod 600`), never shared with production (`/opt/toothcare-prod/.env`).
- Separate database credentials exist for runtime (`DB_USER`), migrations (`MIGRATION_DB_USER`), and monitoring (`MYSQL_EXPORTER_USER`).
- `GITHUB_TOKEN` permissions are strictly scoped (`contents: read`, `packages: write` in `deploy-staging.yml`; `contents: read`, `packages: read` in `deploy-production.yml`).
- Never commit `.env` files, SSH keys, TLS private keys, or place secrets in `VITE_*` variables or CI logs.
