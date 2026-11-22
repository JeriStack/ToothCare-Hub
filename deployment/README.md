# Deployment Configuration and Scripts

This directory contains deployment automation scripts and server configuration templates for ToothCare Hub.

## Contents

- `apache/virtual-host.example.conf` — Example Apache VirtualHost configuration pointing `DocumentRoot` strictly to `backend/public` for non-Docker local/XAMPP fallback environments.
- `scripts/bootstrap-ubuntu-vps.sh` — Idempotent Ubuntu 22.04/24.04 LTS VPS bootstrap script (installs official Docker Engine + Compose v2, configures UFW `22/80/443`, Certbot, non-root deploy user, protected `ssl/` & `backups/` dirs, and `0600` `.env` template).
- `scripts/deploy.sh` — Controlled immutable release deployment script (pulls pre-built images, runs pre-migration backup in prod, applies controlled migrations, starts containers with `--no-build`, and runs health checks).
- `scripts/rollback.sh` — Application-only image rollback script using `.last_known_good_release` or an explicit immutable tag (database recovery is handled separately in `docs/phase-21/database-recovery.md`).
- `scripts/health-check.sh` — Post-deployment smoke and readiness check script across Nginx, SPA routing, PHP API (`/api/v1/health`, `/services`, `/dentists`), edge `403` blocks, and optional synthetic staging login.

## Security Rules

- Never store production credentials, SSH keys, TLS private keys, or database dumps in this directory.
- Inject runtime secrets through protected GitHub Environments or the target host's secret manager.

