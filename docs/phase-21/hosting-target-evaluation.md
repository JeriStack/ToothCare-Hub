# Phase 21 — Hosting Target Evaluation

## 1. Option Comparison Matrix

| Evaluation Area | Linux VPS (Docker Engine + Compose v2 — e.g., DigitalOcean / Hetzner / Vultr / AWS Lightsail) | Managed PaaS (Render / Railway / Fly.io) | Kubernetes (GKE / EKS / AKS) | Shared PHP Hosting |
|---|---|---|---|---|
| **Docker / Compose Support** | Native Docker Engine + Compose v2 | Limited Compose parity; multi-service networking custom | Full (requires Helm/manifests rewrite) | Not supported |
| **Persistent PHP-FPM + Node.js + Workers** | Full support (`php-fpm`, `realtime`, `email-worker`, `reminder-scheduler`) | Paid per-service add-ons; WebSocket/worker pricing scales fast | Full support | Disqualified (no persistent Socket.IO/workers) |
| **MySQL 8.0 + Encrypted Backups** | Full (`mysql:8.0` named volume + `db-backup` daemon or Managed MySQL) | Managed MySQL add-on | Managed Cloud SQL / RDS | Limited |
| **Private Internal Networking & Firewall** | Native Docker `app`/`monitoring` bridge nets + UFW (`80`/`443` + SSH/VPN only) | Platform-managed | NetworkPolicies | None |
| **Prometheus + Grafana + Exporters** | Full native `--profile monitoring --profile monitoring-linux` | Difficult / costly sidecars | Full (kube-prometheus-stack) | Not supported |
| **Staging Monthly Budget** | **Low & predictable (~USD \$12–\$24/mo for 4 GB RAM / 2 vCPU)** | Moderate–High (multiple services) | High (control plane + nodes) | Disqualified |

## 2. Recommended Target Architecture

**Recommended Staging & Initial Production Target:** **Dedicated Linux VPS (Ubuntu 24.04 LTS, >= 2 vCPU, 4 GB RAM, 50 GB SSD) running Docker Engine + Docker Compose v2**, fronted by Nginx (`80`/`443`) with UFW firewall restricting all other ports and SSH/VPN access for administrative monitoring.

- **Remaining Manual Setup (Requires Billing & Domain Ownership):** Provision staging VPS, assign DNS `A`/`AAAA` record (e.g., `staging.<clinic-domain>`), issue TLS certificates (Let's Encrypt Certbot), install Docker Engine, create `/opt/toothcare-staging/.env` from `.env.staging.example`, and populate GitHub `staging` Environment secrets (`STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`, `STAGING_APP_DIR`).
