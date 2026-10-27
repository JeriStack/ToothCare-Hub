# ToothCare Hub - Docker & Container Conventions

This directory houses container runtime definitions, base images, and runtime configuration files for the ToothCare Hub services.

## Service Images

- **`docker/php/Dockerfile`**: Custom PHP 8.5.12-FPM runtime image with `pdo_mysql`, OPcache, Composer, and upload-progress hardening.
- **`docker/php/php.ini`**: Production-safe PHP configuration with `display_errors=Off`, strict sessions, and conservative resource limits.
- **`docker/nginx/Dockerfile`**: Multi-stage production image compiling React static assets and configuring Nginx edge reverse proxy.
- **`realtime/Dockerfile`**: Node.js 20-alpine runtime executing Socket.IO as non-root user.

## Build Rules

1. **Non-Root Execution:** Services run as non-root where supported by the runtime image.
2. **Minimal Layer Bloat:** Dependencies and build packages are cleaned up in the same layer (`apk del .build-deps`).
3. **No Secrets in Images:** Never use `ARG` or `ENV` to embed production credentials, SMTP passwords, or TLS keys.
4. **Health Checks:** Every container defines a Docker `HEALTHCHECK` verifying actual service readiness.
