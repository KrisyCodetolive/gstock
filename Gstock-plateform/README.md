# GStock — backend (API et back-office)

API REST de l'application commerçant GStock (Laravel 12, PostgreSQL, multi-tenant par sous-domaine).

- Cahier des charges (source de vérité) : `docs/cahier-des-charges-gstock-final.md`
- État, démarrage et décisions : `../Gstock-frontend/docs/rapports/` (rapports `B<n>` pour le backend)
- Conventions du dépôt : `../CLAUDE.md`

```bash
docker compose up -d
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve
php artisan test
```
