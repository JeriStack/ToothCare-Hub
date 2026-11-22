# Deployment Configuration and Scripts

This directory contains deployment automation scripts and server configuration templates for ToothCare Hub.

## Contents

- `apache/virtual-host.example.conf` — Example Apache VirtualHost configuration pointing `DocumentRoot` strictly to `backend/public` for non-Docker local/XAMPP fallback environments.
- `scripts/deploy.sh` — Controlled release deployment script (to be implemented in Phase 20/21).
- `scripts/rollback.sh` — Application image rollback script (to be implemented in Phase 20/21; database recovery is handled separately to prevent accidental data loss).
- `scripts/health-check.sh` — Post-deployment smoke and readiness check script across Nginx, PHP API (`/api/v1/health`), and real-time services.

## Security Rules

- Never store production credentials, SSH keys, TLS private keys, or database dumps in this directory.
- Inject runtime secrets through protected GitHub Environments or the target host's secret manager.

