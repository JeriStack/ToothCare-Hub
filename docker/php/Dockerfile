# =============================================================================
# ToothCare Hub — Multi-Stage Production PHP-FPM Backend Image (Phase 20)
# Build context: ./backend
# =============================================================================

# Stage 1: Deterministic production dependency installation (no dev tools in runtime)
FROM composer:2.8 AS composer-builder
WORKDIR /build
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --prefer-dist \
    --optimize-autoloader

# Stage 2: Minimal PHP-FPM 8.5.12 Alpine runtime
# Pinned to PHP 8.5.12 (fixes CVE-2026-109618 / CVE-2026-109619)
FROM php:8.5.12-fpm-alpine3.24 AS runtime

RUN set -eu; \
    for attempt in 1 2 3 4 5; do \
        apk upgrade --no-cache --timeout 30 \
            && apk add --no-cache --timeout 30 --virtual .build-deps $PHPIZE_DEPS \
            && break; \
        if [ "$attempt" -eq 5 ]; then exit 1; fi; \
        echo "apk transient failure (attempt $attempt/5), retrying..." >&2; \
        sleep 3; \
    done \
    && docker-php-ext-install pdo_mysql pcntl \
    && apk del .build-deps

# Production PHP hardening (per CVE-2026-115560 & least-information exposure)
RUN { \
      echo '; ToothCare Hub Production PHP Hardening'; \
      echo 'expose_php = Off'; \
      echo 'display_errors = Off'; \
      echo 'display_startup_errors = Off'; \
      echo 'log_errors = On'; \
      echo 'error_log = /proc/self/fd/2'; \
      echo 'session.upload_progress.enabled = Off'; \
      echo 'session.use_strict_mode = 1'; \
      echo 'session.use_only_cookies = 1'; \
      echo 'session.cookie_httponly = 1'; \
      echo 'memory_limit = 256M'; \
      echo 'upload_max_filesize = 5M'; \
      echo 'post_max_size = 8M'; \
      echo 'max_execution_time = 30'; \
      echo 'opcache.enable = 1'; \
      echo 'opcache.validate_timestamps = 0'; \
      echo 'opcache.max_accelerated_files = 10000'; \
    } > /usr/local/etc/php/conf.d/zz-toothcare.ini

WORKDIR /var/www/backend

# Copy locked production dependencies and runtime application code (excluding tests)
COPY --from=composer-builder --chown=www-data:www-data /build/vendor ./vendor
COPY --chown=www-data:www-data composer.json composer.lock ./
COPY --chown=www-data:www-data public ./public
COPY --chown=www-data:www-data src ./src
COPY --chown=www-data:www-data bin ./bin
COPY --chown=www-data:www-data config ./config
COPY --chown=www-data:www-data templates ./templates
COPY --chown=www-data:www-data openapi ./openapi

# Prepare explicit writable runtime directories only
RUN mkdir -p storage/logs storage/cache storage/uploads/avatars \
    && chown -R www-data:www-data storage \
    && chmod -R 0750 storage

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD php -r '$fp = @fsockopen("127.0.0.1", 9000, $errno, $errstr, 2); exit($fp ? 0 : 1);'

EXPOSE 9000
STOPSIGNAL SIGQUIT
CMD ["php-fpm"]
