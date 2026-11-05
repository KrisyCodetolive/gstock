# Image de production du backend (§12.7) : FrankenPHP (PHP 8.4), configurée par
# variables d'environnement, logs sur stdout/stderr, migrations au démarrage.
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
# Les extensions (intl, bcmath…) sont installées dans l'image finale, pas dans celle de Composer.
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

FROM dunglas/frankenphp:1-php8.4-alpine
RUN install-php-extensions pdo_pgsql intl bcmath gd zip opcache pcntl redis
WORKDIR /app
COPY --from=vendor /app /app
# Nettoyage, dossiers d'exécution, et fichiers du back-office Filament (CSS, JS, polices), non versionnés.
RUN rm -rf tests docker compose.yaml .env .env.example public/css/filament public/js/filament public/fonts/filament \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && APP_KEY=base64:$(head -c 32 /dev/urandom | base64) php artisan filament:assets \
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
