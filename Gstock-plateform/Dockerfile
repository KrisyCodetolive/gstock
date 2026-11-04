# Image de production du backend (§12.7) : FrankenPHP (PHP 8.4), configurée par
# variables d'environnement, logs sur stdout/stderr, migrations au démarrage.
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

FROM dunglas/frankenphp:1-php8.4-alpine
RUN install-php-extensions pdo_pgsql intl bcmath gd zip opcache pcntl redis
WORKDIR /app
COPY --from=vendor /app /app
RUN rm -rf tests docker compose.yaml .env .env.example \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SERVER_NAME=:8080
EXPOSE 8080

COPY docker/entrypoint.sh /usr/local/bin/gstock-entrypoint
RUN chmod +x /usr/local/bin/gstock-entrypoint
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["gstock-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
