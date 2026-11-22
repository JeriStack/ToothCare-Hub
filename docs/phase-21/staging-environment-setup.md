# Staging Environment Setup Guide

## 1. Service Isolation (`compose.staging.yaml`)

Staging runs the exact production container topology (`compose.yaml` + `compose.prod.yaml` + `compose.staging.yaml`) with strict environment isolation:

- **Dedicated Volumes:** `toothcare_staging_mysql_data`, `toothcare_staging_backend_storage`, `toothcare_staging_prometheus_data`, `toothcare_staging_grafana_data`.
- **Dedicated Database & Credentials:** `toothcare_staging` with staging-only credentials from `.env.staging.example`.
- **Controlled Email Sink (Mailpit):** `php-fpm` and `email-worker` route all SMTP traffic to `mailpit:1025`. Web UI is bound strictly to `127.0.0.1:8025` (inspect via SSH tunnel `ssh -L 8025:127.0.0.1:8025 user@staging-host`). Staging **cannot** send real emails to patients.
- **Synthetic Data Only:** Seed staging exclusively using `backend/scripts/seed.php` synthetic fixtures; never copy production dumps or real patient contact data into staging.

## 2. Manual Bootstrap on a Fresh Staging Host

```bash
# 1. Copy staging environment template and fill with staging-only secrets
cp .env.staging.example .env

# 2. Deploy an immutable CI-built image tag (never rebuild on server)
DEPLOY_ENV=staging IMAGE_REGISTRY=ghcr.io/<owner> IMAGE_TAG=sha-<12> \
  bash deployment/scripts/deploy.sh

# 3. Seed synthetic staging accounts/catalog (one-time or controlled reset)
docker compose -f compose.yaml -f compose.prod.yaml -f compose.staging.yaml \
  exec -T php-fpm php scripts/seed.php
```
