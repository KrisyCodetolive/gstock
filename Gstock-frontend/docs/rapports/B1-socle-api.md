# B1 — Socle du backend

> **Statut : terminée** (branche `api-socle`).
> Étape 2 du planning (§15) : « Laravel, Docker, CI, stancl/tenancy, Sanctum, espaces, boutiques, utilisateurs, rôles, permissions prédéfinies, affectations aux boutiques, audit ». Modules M02, M03, M04, M14, et la partie « espace » de M00.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `2074eef` | **Socle** : PostgreSQL 16 en Docker, API `/api/v1`, multi-tenant stancl/tenancy en base unique (espace = sous-domaine), Sanctum (cookie), permissions fixes, rôles, utilisateurs, boutiques, paramètres, clés GeniusPay chiffrées, journal d'audit, données de démonstration. |
| `bbc15a0` | **Tests** (PHPUnit, sur PostgreSQL) : isolation des espaces, connexion et profil, mot de passe oublié, permissions, rôles et utilisateurs, boutiques, paramètres, lecture seule. |
| `bc264e2` | **Frontend** : mode `npm run dev:api`, l'application parle au vrai backend (proxy `/api`, `/sanctum`, `/storage`). |
| `7fd458d` | **Image Docker** (FrankenPHP, migrations au démarrage, `/health`). Le workflow d'intégration continue écrit dans ce commit a été retiré ensuite (voir les limites). |

## Démarrer

```bash
cd Gstock-plateform
docker compose up -d                 # PostgreSQL 16 sur le port 54329 (bases gstock et gstock_test)
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed           # plans + espace de démonstration « alimentation-kone »
php artisan storage:link
php artisan serve                    # http://127.0.0.1:8000
php artisan test                     # 24 tests sur la base gstock_test

cd ../Gstock-frontend && npm run dev:api
# ouvrir http://alimentation-kone.localhost:5173 (l'espace est le sous-domaine)
```

Comptes de démonstration : les mêmes que ceux des données simulées (`aminata@demo.gstock.app`… ou `0700000001`…), mot de passe `demo1234`. Si les ports 8000 ou 5173 sont pris : `php artisan serve --port=8077` puis `GSTOCK_API_URL=http://127.0.0.1:8077 npx vite --mode api --port 5198`.

## Endpoints

Tous sous `/api/v1`, sur le sous-domaine de l'espace. Mêmes formes, règles et messages que les handlers simulés (`Gstock-frontend/src/mocks/handlers/`).

| Endpoint | Permission |
|---|---|
| `POST /auth/login` (e-mail ou téléphone), `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password` | aucune (10 essais par minute) |
| `GET /me`, `PUT /me`, `PUT /me/password`, `POST|DELETE /me/avatar` | connecté |
| `GET|PUT /settings` | `settings.manage` |
| `GET|PUT /settings/payment`, `POST /settings/payment/test` | `payment_settings.manage` |
| `GET /shops` | `shops.manage` ou `users.manage` |
| `GET /shops/{id}`, `POST /shops`, `PUT /shops/{id}` (pas de suppression) | `shops.manage` |
| `GET /permissions` | `roles.manage` |
| `GET /roles` | `roles.manage` ou `users.manage` |
| `GET|POST /roles`, `GET|PUT|DELETE /roles/{id}` | `roles.manage` |
| `GET /users` | `users.manage` ou `shops.manage` |
| `GET /users/{id}`, `POST /users`, `PUT /users/{id}`, `PATCH /users/{id}/status`, `PUT /users/{id}/shops` | `users.manage` |
| `GET /audit-logs` (filtres `domain`, `user_id`, `shop_id`, `from`) | `audit.view` |
| `GET /health` (hors `/api`, domaine central) | aucune |

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `bootstrap/app.php` | Préfixe `/api/v1`, Sanctum (cookie), alias des middlewares, **erreurs JSON en français** au format `{message, errors}` (401, 403, 404, 409, 419, 422, 429). |
| `config/tenancy.php`, `app/Providers/TenancyServiceProvider.php` | stancl/tenancy en base unique : identifiants entiers, espace identifié par le sous-domaine, ni base ni cache par espace. |
| `app/Support/BelongsToTenant.php` | Trait des tables d'espace : `tenant_id` rempli et filtré automatiquement. |
| `app/Domain/Platform/` | `Tenant`, `Plan`, `TenantSubscription`, `SubscriptionState` (essai, payé, délai de grâce de 7 jours, suspendu), `CurrentTenant`, `Actions/ProvisionTenant`. |
| `app/Domain/Identity/` | `User` (un rôle, boutiques affectées, permissions), `Role`, `Permission`, `PasswordResets` (jetons hachés, 60 minutes, usage unique), e-mail `ResetPasswordLink`. |
| `app/Domain/Shops/Models/` | `Shop`, `TenantSetting`, `TenantPaymentSetting` (clés chiffrées par le cast `encrypted`). |
| `app/Domain/Audit/` | `AuditLog` et `Audit::record()`. |
| `app/Http/Middleware/` | `RequirePermission` (`permission:a,b`), `EnsureUserIsActive` (compte désactivé ou d'un autre espace → 401), `EnsureTenantIsWritable` (espace suspendu → 402). |
| `app/Http/Controllers/Api/V1/` | Un contrôleur par ressource. |
| `app/Http/Resources/Present.php` | Formes JSON, identiques aux types de `Gstock-frontend/src/types/`. |
| `app/Support/ListQuery.php` | Listes : `page`, `per_page` (100 au plus), `search` sans accents (`unaccent`), `sort=-champ`, `filter[x]`, réponse `{data, meta}`. |
| `database/migrations/2026_11_04_*` | Tables de la plateforme, identité (et les 42 permissions), boutiques, audit. |
| `database/seeders/DemoTenantSeeder.php` | Espace de démonstration identique à celui des données simulées. |
| `compose.yaml`, `Dockerfile`, `docker/entrypoint.sh` | Base de développement, image de production. |

## Règles du cahier appliquées

- **ADR-002, ADR-009** : une seule base ; chaque table d'espace porte `tenant_id` ; unicités par espace (`users.email`, `users.phone`, `roles.name`, `shops.name`) ; l'espace vient du sous-domaine, jamais d'un paramètre. Un compte n'est jamais accepté sur le sous-domaine d'un autre espace.
- **ADR-008** : session Sanctum par cookie (`/sanctum/csrf-cookie`, `X-XSRF-TOKEN`), un cookie par sous-domaine.
- **ADR-014** : 42 permissions fixes, créées par migration ; rôle Owner créé à l'inscription, avec toutes les permissions, ni modifiable ni supprimable ; rôles libres ; un rôle attribué ne se supprime pas (409) ; un seul rôle par utilisateur ; nouvelles permissions accordées immédiatement à tous les utilisateurs du rôle.
- **§6.2** : permission vérifiée par le serveur sur chaque endpoint ; le propriétaire a accès à toutes les boutiques, les autres seulement aux boutiques affectées ; un compte désactivé perd ses sessions ; le compte du propriétaire n'est modifiable que par lui.
- **M02** : connexion par e-mail ou téléphone (numéro normalisé : espaces, points et `+225` retirés), refus d'un compte désactivé ou d'un espace fermé, limitation du débit ; mot de passe oublié sans énumération des comptes, lien valable 60 minutes et à usage unique, sessions fermées après la réinitialisation.
- **M03** : boutiques jamais supprimées ; limite du plan sur les boutiques ouvertes ; au moins une boutique ouverte ; clés GeniusPay chiffrées en base, jamais renvoyées (seulement « •••• 1234 »), jamais écrites dans le journal.
- **M00** (partie espace) : limites du plan (boutiques, utilisateurs) ; état de l'abonnement dans `GET /me` ; espace suspendu en lecture seule (402 sur toute écriture sauf `/auth/*`).
- **M14** : journal des changements de rôle, d'affectation, d'activation, de mot de passe et de clés de paiement ; les actions sans boutique ne sont visibles que du propriétaire.
- **§12.7** : image Docker configurée par variables d'environnement, logs sur stderr, migrations automatiques au démarrage, `/health`.

## Décisions prises pendant la phase

- **PostgreSQL dans Docker** (`compose.yaml`, port 54329) plutôt que le PostgreSQL de la machine, et **tests sur PostgreSQL** (base `gstock_test`) au lieu de SQLite : le cahier impose `NUMERIC`, `JSONB` et des unicités par espace.
- **Identifiants entiers** pour les espaces (stancl utilise des UUID par défaut) : `tenant_id` est un `bigint` partout.
- **Le sous-domaine seul** est rangé dans `domains` (« alimentation-kone ») ; le domaine central vient de `TENANCY_CENTRAL_DOMAINS` (`localhost` en développement, `gstock.app` en production, `gstock.test` en test).
- **Jetons de réinitialisation propres** (`password_reset_tokens` avec `tenant_id` et `user_id`) : la table par défaut de Laravel a l'e-mail pour clé, or un e-mail n'est unique que dans son espace.
- **Contrôleurs simples** pour le socle (« les référentiels restent en CRUD simple », ADR-001) ; le code métier est rangé par contexte dans `app/Domain/` ; le DDD complet viendra avec Stock, Ventes et Crédits.
- **Test de connexion GeniusPay** : il vérifie pour l'instant que les clés sont enregistrées. L'appel réel arrivera avec l'étape 6 (paiements).
- **Liens dans les e-mails** construits avec `FRONTEND_URL` (`http://{tenant}.localhost:5173` en développement).
- **Tests** : `Sanctum::actingAs` pour les appels d'API ; la vraie connexion par cookie est testée de bout en bout dans `AuthTest`.

## Vérifications faites

- **24 tests automatisés, 203 assertions**, sur PostgreSQL : isolation des espaces (même e-mail dans deux espaces, enregistrements d'un autre espace introuvables en 404, compte refusé sur le sous-domaine d'un autre espace, boutique d'un autre espace refusée à l'affectation, sous-domaine inconnu en 404, `tenant_id` rempli) ; connexion par e-mail et par téléphone, refus (mauvais mot de passe, compte désactivé, espace fermé) ; déconnexion ; mot de passe oublié (même réponse pour un compte inconnu, lien à usage unique, lien expiré) ; profil (téléphone déjà pris, normalisation), changement de mot de passe, photo ; permissions vérifiées sur chaque endpoint ; rôles (noms réservés et en double, Owner protégé, permissions appliquées tout de suite, suppression refusée si le rôle est attribué) ; utilisateurs (rôle Owner réservé, compte du propriétaire protégé, désactivation qui coupe l'accès, limite du plan) ; boutiques (unicité, limite du plan, au moins une ouverte) ; clés GeniusPay chiffrées et jamais renvoyées ; lecture seule d'un espace suspendu et délai de grâce ; journal visible du propriétaire seulement.
- **Navigateur** (frontend en `dev:api`, Chrome piloté) : connexion réelle par cookie, erreur de mot de passe venue du serveur, listes des utilisateurs, rôles et boutiques lues dans PostgreSQL, paramètres enregistrés, téléphone déjà pris refusé dans le profil, création d'un rôle, vendeuse refusée dans les paramètres.
- **Image Docker** construite et démarrée contre PostgreSQL : migrations jouées au démarrage, `/health` répond `ok`, sous-domaine inconnu en 404.
- `vendor/bin/pint --test` passe.

## Limites

- **Pas encore côté serveur** : inscription (`/register`, `/plans`), assistant de démarrage, « Mon abonnement », factures et webhooks GeniusPay (M00, étape 6) ; back-office Filament (M01, étape 3) ; tous les modules métier (référentiels, produits, stock, clients, ventes, crédits, approvisionnements, dépenses, tableau de bord, synchronisation : étape 4). En mode `dev:api`, les écrans de ces modules affichent donc une erreur.
- Le provisionnement ne crée pas encore les **référentiels par défaut** (unités, modes de paiement, catégories de dépenses) : ils arriveront avec leur module.
- **Jetons par appareil** pour la PWA installée (ADR-008) : non faits, seule la session par cookie existe.
- **Logo de l'espace** : pas d'envoi pour l'instant (`logo_url` vaut toujours null).
- **Documentation OpenAPI** (§9, §12.6) : pas encore générée.
- Les e-mails partent par la file de tâches : en développement, `composer dev` lance le worker ; sans lui, rien n'est envoyé. Le mailer par défaut est `log`.
- **Intégration continue** (§12.6) : mise de côté pour l'instant, à la demande du propriétaire du projet. Le workflow (Pint, tests sur PostgreSQL, lint et build du frontend, image Docker) se retrouve dans le commit `7fd458d` pour être remis en place plus tard.
