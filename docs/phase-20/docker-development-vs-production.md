# Docker Development vs. Production Environment Separation

| Aspect | Development (`compose.yaml` + `compose.dev.yaml`) | Production (`compose.yaml` + `compose.prod.yaml`) |
|---|---|---|
| **Command** | `docker compose -f compose.yaml -f compose.dev.yaml up -d` | `IMAGE_TAG=vX.Y.Z docker compose -f compose.yaml -f compose.prod.yaml up -d` |
| **Source Code** | Host bind mounts (`./backend`, `./nginx`, `./frontend/dist`) | Immutable multi-stage images (zero host source bind mounts) |
| **Frontend Serving** | Local `frontend/dist` or optional `--profile frontend-dev` Vite HMR | Compiled assets baked inside `toothcare-frontend:<tag>` Nginx image |
| **Debug & Cookies** | `APP_ENV=development`, `APP_DEBUG=true`, `SESSION_COOKIE_SECURE=false` | `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_COOKIE_SECURE=true` |
| **MySQL Host Port** | `127.0.0.1:3306:3306` | Not published (private `toothcare_app` network only) |
| **Mailpit / phpMyAdmin** | Opt-in (`--profile mail`, `--profile tools`) | Excluded from production |
| **Security & Limits** | Standard dev defaults | `no-new-privileges`, `cap_drop: [ALL]`, `read_only` (realtime), CPU/memory limits, `restart: always` |
