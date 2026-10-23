# PHP-FPM image for the ToothCare Hub backend API
FROM php:8.3-fpm-alpine

# System deps and PHP extensions
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && docker-php-ext-install pdo pdo_mysql opcache \
    && apk del .build-deps

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend

# Install dependencies first for better layer caching
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist || true

COPY . .

EXPOSE 9000
CMD ["php-fpm"]
