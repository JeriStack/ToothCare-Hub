# Security Checklist

This document tracks security controls for ToothCare Hub. It is maintained as controls
are implemented; the sections below cover the runtime hardening applied so far.

## PHP runtime (Docker)

- **Pinned version:** The backend image is pinned to `php:8.5.12-fpm-alpine3.24`
  (`docker/php/Dockerfile`), not a floating `8.5` tag, so rebuilds are reproducible and
  the patch level is explicit.
- **PHP2Shell (CVE-2026-109618, CVE-2026-109619):** Two critical unauthenticated RCE
  flaws (CVSS 9.2) in the PHP interpreter, fixed in the 2026-10-21 security release.
  Running PHP 8.5.12 addresses them.
- **Session upload progress (CVE-2026-115560):** A follow-up advisory (2026-10-23)
  describes an RCE path in PHP's session upload-progress feature with no upstream patch
  as of 2026-10-24. Mitigation: `session.upload_progress.enabled = Off`, applied via
  `conf.d/zz-toothcare.ini` baked into the image. The backend REST API does not use this
  feature, so disabling it does not affect functionality. Re-evaluate once a fixed PHP
  release ships.
- **Information disclosure:** `expose_php = Off` so the `X-Powered-By` header does not
  advertise the PHP version.

Upgrading PHP closes the flaws above; it does not by itself make the application secure.
Application-level controls (authentication, authorization, input validation, CSRF, rate
limiting, prepared statements) remain required and are tracked separately.

## Verifying the runtime

```
docker compose build backend
docker compose run --rm backend php -v          # expect PHP 8.5.12
docker compose run --rm backend php -i | grep session.upload_progress.enabled   # Off
```
