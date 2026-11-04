# B8 — Inscription, assistant de démarrage et abonnement (backend)

> **Statut : terminée** (branche `api-inscription`).
> Module M00 « Plateforme SaaS » du cahier, côté serveur : un commerçant s'inscrit, démarre et paie son abonnement sans aide.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `77f27b7` | Toute la phase : formules et vérification de l'adresse, inscription et lien de connexion, assistant de démarrage, « Mon abonnement », paiement GeniusPay et page de paiement simulée, 8 tests. |

Le détail du commit :
- **Inscription** : les formules, la vérification de l'adresse avec une proposition, l'inscription qui provisionne l'espace, puis un lien de connexion à usage unique.
- **Assistant de démarrage** : ses trois étapes.
- **« Mon abonnement »** : l'état de l'abonnement, l'utilisation comparée aux limites, les factures `FA-N`.
- **Paiement GeniusPay** : lancé par le serveur, validé par un webhook signé et idempotent.
- **Page de paiement simulée** : réservée au développement.
- **Démonstration** : les factures de l'espace de démonstration.

Ce qui existait déjà depuis B1 a été réutilisé :
- le provisionnement d'un espace (`ProvisionTenant`) ;
- le calcul de l'état de l'abonnement (`SubscriptionState`) ;
- la lecture seule (402) ;
- les limites des formules sur les boutiques, les utilisateurs et les produits.

## Endpoints

Sous `/api/v1`. Les formes JSON sont identiques à `Gstock-frontend/src/types/subscription.ts`, et les règles reprennent celles de `src/mocks/handlers/platform.ts`.

| Endpoint | Où | Accès |
|---|---|---|
| `GET /plans` | domaine principal (et espace) | public |
| `GET /register/check-slug?slug=` | domaine principal | public, 60 par minute |
| `POST /register` | domaine principal | public, 10 par minute |
| `POST /auth/token-login` (`token`) | sous-domaine de l'espace | lien à usage unique |
| `GET /onboarding`, `POST /onboarding/steps/{étape}/skip`, `POST /onboarding/dismiss` | espace | propriétaire |
| `GET /subscription`, `GET /subscription/invoices` | espace | `subscription.manage` |
| `POST /subscription/checkout` (`plan_id`) | espace | `subscription.manage`, **permis en lecture seule** |
| `POST /webhooks/geniuspay/platform` | domaine principal | signature `X-GeniusPay-Signature` |
| `GET /simulation/geniuspay/{facture}` et `…/pay` | hors production | liens signés et temporaires |

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_11_06_000100_create_tenant_invoices_table.php` | `tenant_invoices` (§8.1) : facture `FA-N`, formule, montant, état, moyen de paiement, numéro de transaction GeniusPay (unique). |
| `app/Domain/Platform/Registration/RegistrationService.php` | Règles de l'adresse (3 à 30 caractères, minuscules, chiffres et tirets, adresses réservées, déjà prise), proposition libre la plus proche, validation, provisionnement, lien de connexion. |
| `app/Domain/Platform/Registration/LoginLinks.php` | Lien à usage unique, valable 10 minutes et lié à l'espace. Seule l'empreinte du jeton est gardée ; une seule utilisation réussit, même en cas de double clic. |
| `app/Domain/Platform/OnboardingService.php` | Les trois étapes, qui se cochent d'elles-mêmes. Les étapes passées et la fermeture sont gardées dans l'espace (`tenants.data`). Tient aussi les indicateurs `activated_at` et `first_sale_at` pour le back-office. |
| `app/Domain/Platform/Billing/SubscriptionService.php` | Page « Mon abonnement », utilisation, lancement du paiement (contrôle des limites quand on passe à une formule plus petite), traitement du webhook. |
| `app/Domain/Platform/Billing/PlatformGateway.php`, `SimulatedPlatformGateway.php` | Interface du paiement et pilote de simulation, choisi par `GENIUSPAY_PLATFORM_DRIVER`. Le pilote de simulation est refusé en production (`AppServiceProvider`). |
| `app/Domain/Platform/Billing/WebhookSignature.php` | HMAC SHA-256 du corps brut, comparaison à temps constant. |
| `app/Http/Controllers/GeniusPaySimulationController.php`, `resources/views/geniuspay/simulation.blade.php` | Page de paiement simulée (développement) : choix du moyen, paiement réussi ou refusé, retour sur « Mon abonnement ». |
| `app/Http/Controllers/Api/V1/RegistrationController.php`, `SubscriptionController.php`, `OnboardingController.php`, `GeniusPayWebhookController.php`, `AuthController::tokenLogin` | Endpoints. |
| `config/gstock.php`, `.env.example` | `login_link_ttl`, `geniuspay.platform` (pilote, clés, secret du webhook), retour après paiement. |
| `tests/Feature/RegistrationTest.php`, `SubscriptionTest.php` | 8 tests. |

## Règles du cahier appliquées

- **M00, inscription** : une inscription crée un espace utilisable tout de suite sur son sous-domaine. Le provisionnement crée :
  - le propriétaire avec le rôle Owner ;
  - la première boutique ;
  - les unités par défaut ;
  - les modes de paiement Espèces, Mobile Money et Carte ;
  - les catégories de dépenses ;
  - un essai de 14 jours.

  Les messages de validation sont ceux du frontend. Une inscription refusée ne crée rien.
- **ADR-009** : l'adresse est le sous-domaine. Les adresses de la plateforme (`www`, `admin`, `api`…) sont réservées.
- **Lien de connexion** : il n'ouvre que son espace, une seule fois, pendant 10 minutes. Présenté à un autre espace, il reste valable pour le sien.
- **M00, assistant de démarrage** : ajouter des produits, saisir les dettes existantes, faire une première vente. Une étape se coche quand c'est fait, peut être passée, et l'assistant peut être fermé. Il est réservé au propriétaire.
- **ADR-003, paiement** :
  - un paiement n'est validé qu'au webhook, jamais au retour du navigateur ;
  - un paiement réussi prolonge l'abonnement d'une période (un mois, ou douze pour une formule annuelle), à partir de la fin en cours, ou d'aujourd'hui si elle est passée ;
  - la formule payée devient celle de l'abonnement ;
  - un échec ne change rien ;
  - un webhook rejoué n'a aucun effet ;
  - une signature invalide renvoie 401 ;
  - un nouveau paiement marque l'ancien, abandonné, comme échoué.
- **M00, limites** : on ne peut pas passer à une formule plus petite que l'utilisation actuelle. Le message dit quoi réduire : « Vous avez 2 boutiques ouvertes (cette formule en permet 1)… ».
- **M00, suspension** : un espace impayé après le délai de grâce reste consultable, mais ses écritures sont refusées (402). Payer l'abonnement et utiliser l'assistant restent permis, et l'espace se rouvre dès que le paiement est confirmé.

## Décisions prises pendant la phase

- **GeniusPay sans documentation** : le cahier ne décrit pas l'API de GeniusPay, et nous n'avons ni accès ni clés. Le paiement passe donc par une interface (`PlatformGateway`), et le seul pilote livré est la **simulation** : une page servie par l'API, qui joue le rôle de GeniusPay. En production, sans vrai pilote, le lancement d'un paiement échoue clairement plutôt que de simuler. **Le format du webhook est provisoire** : `{event: "payment.succeeded" | "payment.failed", data: {reference, transaction_id, channel}}`, signé par HMAC SHA-256. Il faudra l'adapter au format réel de GeniusPay. **À faire dès que l'accès à GeniusPay est fourni.**
- **Lien de connexion gardé dans le cache** de Laravel plutôt que dans une table : il est éphémère et à usage unique.
- **Références des factures** : `FA-<id>`, numérotées pour toute la plateforme, car les factures sont émises par Genius Groups.
- **Démonstration** : l'espace « Alimentation Koné » a les trois factures des données simulées (`FA-1` payée par Wave, `FA-2` refusée, `FA-3` payée par Orange Money).

## Vérifications faites

- **85 tests passent** (803 assertions), dont 8 nouveaux :
  - formules et règles de l'adresse (prise, réservée, invalide, trop courte, propositions) ;
  - inscription refusée sans rien créer, puis acceptée : provisionnement, essai de 14 jours, lien n'ouvrant que son espace et une seule fois, connexion ensuite par mot de passe ;
  - lien expiré ;
  - assistant de démarrage : étapes qui se cochent, étape passée, fermeture, indicateurs du back-office, refus pour un non-propriétaire ;
  - page « Mon abonnement », lancement d'un paiement, remplacement du paiement abandonné, refus d'une formule trop petite, droits ;
  - webhook : signature refusée, échec sans effet, réussite qui prolonge et change de formule, rejeu sans effet ;
  - espace suspendu : lecture seule, paiement permis, réouverture après paiement ;
  - page de paiement simulée : signature exigée, paiement, retour.
- **Navigateur** (frontend en `dev:api`) :
  - « Créer mon espace » : adresse déjà prise puis libre, vérifiées par le serveur ; formules lues sur le serveur ;
  - création de l'espace, puis le lien de connexion ouvre le nouveau sous-domaine déjà connecté ;
  - l'assistant de démarrage (« 0 sur 3 », essai de 14 jours) et une étape passée ;
  - « Mon abonnement » en essai, la page de paiement simulée, le paiement par Orange Money, et le retour avec la facture `FA-4` payée et un abonnement payé jusqu'au 18 décembre, soit la fin de l'essai plus un mois.

  Aucune réponse en erreur.
- `vendor/bin/pint --test` passe.

## Pièges rencontrés

- `php artisan serve` ne transmet au serveur PHP qu'une liste fixe de variables d'environnement. Une variable passée en ligne de commande, comme `FRONTEND_URL`, est ignorée : il faut la mettre dans `.env`, ou lancer `php -S` depuis `public/` avec `vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php`.
- En développement, le lien de connexion pointe vers `FRONTEND_URL` (par défaut `http://{tenant}.localhost:5173`). Si le frontend tourne sur un autre port, il faut adapter cette variable.

## Limites

- **Pilote GeniusPay réel** à écrire dès que la documentation et les clés de la plateforme sont disponibles. Il faudra aussi adapter le format du webhook.
- **Encaissements des boutiques par GeniusPay** (clés du commerçant, webhook `/webhooks/geniuspay/{tenant}`) : les paiements restent `pending`, comme depuis B4. C'est la même dépendance.
- **Pas de tâche planifiée** : l'état de l'abonnement est recalculé à chaque requête à partir des dates, ce qui suffit pour la lecture seule. Les relances par e-mail ou SMS avant la fin de l'essai ne sont pas faites.
- **Facture en PDF** : non faite, et le contrat d'API ne la prévoit pas encore.
