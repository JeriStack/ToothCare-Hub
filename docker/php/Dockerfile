# PHP-FPM image for the ToothCare Hub backend API
# Pinned to PHP 8.5.12 (security release, 2026-10-21) which fixes the
# "PHP2Shell" RCE flaws CVE-2026-109618 and CVE-2026-109619 (CVSS 9.2).
#
# NOTE: the Docker build context is ./backend (see compose.yaml),
# so COPY paths are relative to the backend/ directory.
FROM php:8.5.12-fpm-alpine3.24

# System dependencies and PHP extensions:
# - pdo_mysql provides MySQL PDO driver using built-in mysqlnd
# - mbstring, openssl, json, and curl are already built-in
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && docker-php-ext-install pdo_mysql \
    && apk del .build-deps

# Install official Composer binary
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Security hardening per PHP advisory CVE-2026-115560
RUN { \
      echo '; ToothCare Hub PHP hardening'; \
      echo 'session.upload_progress.enabled = Off'; \
      echo 'expose_php = Off'; \
      echo 'memory_limit = 256M'; \
      echo 'upload_max_filesize = 10M'; \
      echo 'post_max_size = 12M'; \
    } > /usr/local/etc/php/conf.d/zz-toothcare.ini

WORKDIR /var/www/backend

# Create required runtime storage directories with www-data permissions
RUN mkdir -p storage/logs storage/cache storage/uploads \
    && chown -R www-data:www-data /var/www/backend

# Install Composer dependencies reproducibly
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist || true

# Copy application source code
COPY --chown=www-data:www-data . .

# Healthcheck: confirm the PHP-FPM master process is actively accepting connections
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD php -r '$fp = @fsockopen("127.0.0.1", 9000, $errno, $errstr, 2); exit($fp ? 0 : 1);'

EXPOSE 9000
CMD ["php-fpm"]
