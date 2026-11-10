#!/bin/sh
# Démarrage du conteneur : migrations automatiques (§12.7), caches de configuration.
# CONTAINER_ROLE=worker (file d'attente) : pas de migrations, le conteneur « app » s'en charge,
# pour que deux conteneurs ne migrent jamais la base en même temps.
set -e
if [ "${CONTAINER_ROLE:-app}" = "app" ]; then
    php artisan migrate --force
    php artisan db:seed --class=PlanSeeder --force
    php artisan storage:link >/dev/null 2>&1 || true
fi
php artisan config:cache
php artisan route:cache
exec "$@"
