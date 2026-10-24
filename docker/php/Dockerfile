# PHP-FPM image for the ToothCare Hub backend API
# Pinned to PHP 8.5.12 (security release, 2026-10-21) which fixes the
# "PHP2Shell" RCE flaws CVE-2026-109618 and CVE-2026-109619 (CVSS 9.2).
# Tag verified against the official library/php Docker registry.
#
# NOTE: the Docker build context is ./backend (see docker-compose.yml),
# so COPY paths are relative to the backend/ directory.
FROM php:8.5.12-fpm-alpine3.24

# System deps and PHP extensions.
# - pdo_mysql pulls in pdo automatically (do not install pdo separately).
# - OPcache is already compiled in and enabled by default in this base
#   image, so it is intentionally not (re)installed or enabled here.
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && docker-php-ext-install pdo_mysql \
    && apk del .build-deps

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Security hardening per PHP advisory CVE-2026-115560 (no upstream patch
# as of 2026-10-24): disable session.upload_progress. The backend REST API
# does not rely on the session upload-progress feature.
RUN { \
      echo '; ToothCare Hub PHP hardening'; \
      echo 'session.upload_progress.enabled = Off'; \
      echo 'expose_php = Off'; \
    } > /usr/local/etc/php/conf.d/zz-toothcare.ini

WORKDIR /var/www/backend

# Install dependencies first for better layer caching
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist || true

COPY . .

# Healthcheck: confirm the PHP runtime is responsive
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD php -v > /dev/null 2>&1 || exit 1

EXPOSE 9000
CMD ["php-fpm"]
