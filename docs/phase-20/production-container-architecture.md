# Production Container Architecture

## 1. Multi-Stage Release Images

| Image | Dockerfile | Build Stage(s) | Runtime Base | Non-Root / Hardening |
|---|---|---|---|---|
| `toothcare-frontend:<tag>` | `docker/nginx/Dockerfile` | `node:24-alpine` (`npm ci && npm run build`) | `nginx:1.27-alpine` | No Node/npm in runtime; `no-new-privileges`, `cap_drop: [ALL]` + minimal bind/uid caps; `STOPSIGNAL SIGQUIT` |
| `toothcare-backend:<tag>` | `docker/php/Dockerfile` | `composer:2.8` (`composer install --no-dev --optimize-autoloader`) | `php:8.5.12-fpm-alpine3.24` | No Composer or `tests/` in runtime; `www-data` workers; OPcache enabled; `storage/` `0750`; `STOPSIGNAL SIGQUIT` |
| `toothcare-realtime:<tag>` | `realtime/Dockerfile` | `node:24-alpine` (`npm ci && npm run build`) | `node:24-alpine` (`npm ci --omit=dev`) | `USER node`; `read_only: true` + `tmpfs /tmp`; `cap_drop: [ALL]`; `STOPSIGNAL SIGTERM` |

## 2. Shared Backend Runtime Reuse

`php-fpm`, `realtime-worker`, `email-worker`, `reminder-scheduler`, and `db-backup` all share the single immutable `toothcare-backend:<tag>` image with distinct entrypoints/commands and persistent `backend-storage:/var/www/backend/storage` volume, preventing drift between API and background workers.
