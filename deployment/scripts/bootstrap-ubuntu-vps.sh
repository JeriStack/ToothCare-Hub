#!/usr/bin/env bash
# =============================================================================
# ToothCare Hub — Ubuntu 24.04 LTS VPS Bootstrap Script (Docker + UFW + Layout)
#
# Automates idempotent host preparation on a fresh Ubuntu 22.04/24.04 VPS:
#   1. Installs official Docker Engine + Docker Compose v2 plugin via Docker APT repo
#   2. Configures UFW firewall (deny incoming by default; allow OpenSSH, 80, 443 only)
#   3. Installs Certbot & unattended security upgrades
#   4. Configures a non-root deploy user in the `docker` group
#   5. Prepares the application directory, protected storage paths, and .env (chmod 600)
#
# Usage (as root or with sudo):
#   sudo DEPLOY_ENV=staging DEPLOY_USER=toothcare REPO_URL=https://github.com/<org>/ToothCare-Hub.git \
#     bash bootstrap-ubuntu-vps.sh
#
# Safety Rules:
#   - Never overwrites an existing .env file
#   - Never generates or embeds hardcoded production credentials
#   - Never deletes existing Docker volumes or backups
# =============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Please run this script with sudo or as root." >&2
  exit 1
fi

DEPLOY_ENV="${DEPLOY_ENV:-staging}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-toothcare}}"
REPO_URL="${REPO_URL:-}"
REPO_BRANCH="${REPO_BRANCH:-main}"

case "${DEPLOY_ENV}" in
  staging)
    APP_DIR="${APP_DIR:-/opt/toothcare-staging}"
    ENV_TEMPLATE=".env.staging.example"
    ;;
  production)
    APP_DIR="${APP_DIR:-/opt/toothcare-prod}"
    ENV_TEMPLATE=".env.example"
    ;;
  *)
    echo "ERROR: DEPLOY_ENV must be 'staging' or 'production' (got '${DEPLOY_ENV}')." >&2
    exit 1
    ;;
esac

echo "[bootstrap] Preparing Ubuntu VPS for ToothCare Hub (env=${DEPLOY_ENV}, user=${DEPLOY_USER}, dir=${APP_DIR})"

# 1. Verify Ubuntu / Debian base
if [ ! -f /etc/os-release ]; then
  echo "ERROR: Cannot detect OS (/etc/os-release missing)." >&2
  exit 1
fi
# shellcheck source=/dev/null
. /etc/os-release
if [ "${ID:-}" != "ubuntu" ] && [ "${ID:-}" != "debian" ]; then
  echo "ERROR: This script targets Ubuntu/Debian (detected: ${ID:-unknown})." >&2
  exit 1
fi

# 2. Base security & utility packages
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  git \
  ufw \
  certbot \
  unattended-upgrades

# 3. Install official Docker Engine + Compose v2 plugin (idempotent)
if ! command -v docker >/dev/null 2>&1; then
  echo "[bootstrap] Installing Docker Engine & Compose v2 from official Docker APT repository..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  ARCH="$(dpkg --print-architecture)"
  CODENAME="${VERSION_CODENAME:-noble}"
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
else
  echo "[bootstrap] Docker already installed: $(docker --version)"
fi

systemctl enable --now docker
docker compose version

# 4. Ensure dedicated non-root deploy user exists and belongs to docker group
if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  echo "[bootstrap] Creating non-root deploy user '${DEPLOY_USER}'..."
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi
usermod -aG docker "${DEPLOY_USER}"

# 5. Configure UFW firewall (allow ONLY SSH 22/tcp, HTTP 80/tcp, HTTPS 443/tcp)
if grep -qiE "(microsoft|wsl)" /proc/version 2>/dev/null; then
  echo "[bootstrap] WSL detected — skipping UFW firewall setup (managed by Windows host)."
else
  echo "[bootstrap] Configuring UFW firewall (22/tcp, 80/tcp, 443/tcp)..."
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  ufw status verbose
fi

# 6. Prepare application directory, protected TLS & backup folders
mkdir -p "${APP_DIR}" "${APP_DIR}/docker/nginx/ssl" "${APP_DIR}/backups"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"
chmod 0700 "${APP_DIR}/docker/nginx/ssl"
chmod 0750 "${APP_DIR}/backups"

# 7. Clone repository if REPO_URL is provided and directory is not yet a git checkout
if [ -n "${REPO_URL}" ] && [ ! -d "${APP_DIR}/.git" ]; then
  echo "[bootstrap] Cloning repository into ${APP_DIR} (branch=${REPO_BRANCH})..."
  su - "${DEPLOY_USER}" -c "git clone --branch '${REPO_BRANCH}' '${REPO_URL}' '${APP_DIR}'"
fi

# 8. Initialize .env from template without ever overwriting an existing .env
if [ -f "${APP_DIR}/${ENV_TEMPLATE}" ] && [ ! -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/${ENV_TEMPLATE}" "${APP_DIR}/.env"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/.env"
  chmod 0600 "${APP_DIR}/.env"
  echo "[bootstrap] Created ${APP_DIR}/.env from ${ENV_TEMPLATE} (chmod 600)."
elif [ -f "${APP_DIR}/.env" ]; then
  chmod 0600 "${APP_DIR}/.env"
  echo "[bootstrap] Preserved existing ${APP_DIR}/.env (chmod 600)."
fi

cat <<EOF

===============================================================================
 ToothCare Hub Ubuntu VPS Bootstrap Complete (${DEPLOY_ENV})
===============================================================================
 Next manual steps before first deployment:
   1. Edit ${APP_DIR}/.env and replace all CHANGE_ME_* placeholders with unique
      ${DEPLOY_ENV}-only secrets (never share staging & production credentials).
   2. Provision TLS certificates for your domain (e.g., certbot certonly) and
      place fullchain.pem + privkey.pem in ${APP_DIR}/docker/nginx/ssl/.
   3. Add ${DEPLOY_USER}'s SSH deploy key to GitHub Environment '${DEPLOY_ENV}'
      secrets (SSH host, user, key, and app dir=${APP_DIR}).
   4. Trigger deployment from GitHub Actions or run:
        cd ${APP_DIR}
        DEPLOY_ENV=${DEPLOY_ENV} IMAGE_REGISTRY=ghcr.io/<owner> IMAGE_TAG=<tag> \\
          bash deployment/scripts/deploy.sh
===============================================================================
EOF
