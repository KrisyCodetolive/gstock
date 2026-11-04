#!/bin/sh
# Démarrage du conteneur : migrations automatiques (§12.7), caches de configuration.
set -e
php artisan migrate --force
php artisan db:seed --class=PlanSeeder --force
php artisan storage:link >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache
exec "$@"
