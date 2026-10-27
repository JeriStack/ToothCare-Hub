# ToothCare Hub — Phase 1 Docker Build Context Security

**Document ID:** `TCH-P1-DOCKER-SEC-001`  
**Version:** `1.0`  
**Phase:** `Phase 1 — Repository, Local Environment, and Team Workflow`  
**Prepared Date:** `2026-10-27`

---

## 1. Why Context-Specific `.dockerignore` Files Are Mandatory

When Docker builds an image, it looks for a `.dockerignore` file **at the root of the specified `build.context` directory**, not necessarily the repository root.

In [`docker-compose.yml`](../../docker-compose.yml), the three buildable application services use nested build contexts:

| Compose Service | Build Context (`context:`) | Dockerfile Path | Governing `.dockerignore` File |
|---|---|---|---|
| *(Root / Full-Repo Context)* | `.` | *(Any root-context build)* | [`.dockerignore`](../../.dockerignore) |
| `backend` | `./backend` | [`docker/php/Dockerfile`](../../docker/php/Dockerfile) | [`backend/.dockerignore`](../../backend/.dockerignore) |
| `frontend` | `./frontend` | [`frontend/Dockerfile`](../../frontend/Dockerfile) | [`frontend/.dockerignore`](../../frontend/.dockerignore) |
| `realtime` | `./realtime` | [`realtime/Dockerfile`](../../realtime/Dockerfile) | [`realtime/.dockerignore`](../../realtime/.dockerignore) |

Without `backend/.dockerignore`, `frontend/.dockerignore`, and `realtime/.dockerignore`, executing `COPY . .` inside those Dockerfiles would copy `backend/.env`, `frontend/.env`, `realtime/.env`, local `vendor/`, `node_modules/`, and `storage/logs/*` directly into the container image layers!

All four `.dockerignore` files have been created and verified in Phase 1 prior to any image build.

---

## 2. Excluded vs. Preserved Content by Context

### 2.1 Excluded From All Build Contexts (Never Enter Image Layers)
- **Version Control & CI Metadata:** `.git/`, `.gitignore`, `.github/`
- **Environment Secrets & Keys:** `.env`, `.env.*`, `*.local`, `*.pem`, `*.key`, `*.crt`, `*.pfx`, `*.p12`, `docker/nginx/ssl/*`
- **Host Dependencies & Build Artifacts:** `node_modules/`, `vendor/`, `dist/`, `build/` (dependencies are installed cleanly inside the container build stage from locked manifests)
- **Runtime Logs, Caches & Uploads:** `*.log`, `storage/logs/*`, `storage/cache/*`, `storage/uploads/*`, `.cache/`, `tmp/`
- **Tests, Coverage & Database Backups:** `tests/`, `coverage/`, `.phpunit.result.cache`, `.vitest/`, `*.sql.bak`, `*.sql.gz`, `*.dump`, `*.sqlite`
- **IDE & OS Clutter:** `.idea/`, `.vscode/`, `.DS_Store`, `Thumbs.db`

### 2.2 Preserved for Reproducible Image Builds
- **Backend (`./backend`):** `composer.json`, `composer.lock`, `public/index.php`, `config/*.php`, `src/**/*.php`, `templates/emails/*.php`, `storage/*/.gitkeep`, `.env.example`.
- **Frontend (`./frontend`):** `package.json`, `package-lock.json`, `index.html`, `vite.config.*`, `public/**`, `src/**`, `.env.example`.
- **Realtime (`./realtime`):** `package.json`, `package-lock.json`, `src/**`, `.env.example`.

---

## 3. How to Verify Image Layers Do Not Contain Secrets or Host Dependencies

Once package manifests (`package-lock.json`, `composer.lock`) are populated and images are built in Phase 2+, run these verification checks before pushing or deploying any image:

```powershell
# 1. Confirm no .env file exists inside built containers
docker-compose run --rm backend sh -c "ls -la /var/www/backend/.env"
# Expected: No such file or directory (runtime env vars are injected by Compose, not baked into the image)

# 2. Confirm storage/logs and tests are not baked into the production backend image
docker-compose run --rm backend sh -c "ls -la /var/www/backend/tests"
# Expected: No such file or directory

# 3. Inspect image history to ensure no secret ARG/ENV values were passed at build time
docker history toothcare-hub-backend
```

