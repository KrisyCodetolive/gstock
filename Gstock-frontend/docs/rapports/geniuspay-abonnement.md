# Paiement de l'abonnement par GeniusPay

| | |
|---|---|
| **Statut** | Livré le 10 novembre 2026, testé contre le sandbox GeniusPay |
| **Branche** | `api-geniuspay` |
| **Cahier** | M00 (abonnement), ADR-003 (paiements avec GeniusPay, validation par le serveur de GeniusPay) |

## Commits

| Commit | Contenu |
|---|---|
| `feat(abonnement)` | Pilote GeniusPay réel (API marchand), webhook signé et confirmé, relecture de l'état au retour, commande `gstock:geniuspay-webhook`, variables d'environnement, tests |
| `docs` | Ce rapport, README, `CLAUDE.md`, `DEPLOIEMENT-COOLIFY.md` |

## Ce qui change pour le commerçant

Rien à l'écran : « Mon abonnement » (`/parametres/abonnement`, permission `subscription.manage`) envoie toujours sur une page de paiement, mais c'est maintenant la **vraie page de GeniusPay** (`https://geniuspay.ci/checkout/…`). Le commerçant y choisit Wave, Orange Money, MTN, Moov ou la carte, puis revient sur « Mon abonnement ». L'abonnement est prolongé dès que GeniusPay confirme le paiement.

## Fonctionnement

1. `POST /subscription/checkout` crée la facture `FA-N` « en attente », puis appelle `POST https://pay.genius.ci/api/v1/merchant/payments` en mode page de paiement (sans `payment_method`). Le montant est en FCFA. `metadata.invoice` = `FA-N`, `success_url` et `error_url` = « Mon abonnement ». La référence GeniusPay (`MTX-…`, ou `SANDBOX_…` en test) est gardée dans `tenant_invoices.geniuspay_transaction_id`.
   - GeniusPay injoignable ou qui refuse : **502** « Le paiement GeniusPay n'a pas pu être lancé. Réessayez dans un instant. », et la facture passe en `failed` au lieu de rester en attente.
2. **Webhook** `POST /api/v1/webhooks/geniuspay/platform` (domaine principal) :
   - Vérification de la signature `X-Webhook-Signature` = HMAC-SHA256(`X-Webhook-Timestamp` + « . » + corps, `whsec_…`). Le timestamp doit dater de moins de 5 minutes. Sinon : 401.
   - La facture est retrouvée par `data.metadata.invoice`, ou à défaut par la référence GeniusPay.
   - `payment.success` : le paiement est **relu chez GeniusPay** (`GET /payments/{référence}`) avant toute prolongation. Il faut que le statut soit `completed` et que le montant ne soit pas inférieur à la facture.
   - `payment.failed`, `payment.cancelled` et `payment.expired` : la facture passe en `failed`. Les autres événements (`payment.initiated`, `webhook.test`…) ne changent rien.
   - Un webhook d'un autre environnement que celui des clés (sandbox ou live) est ignoré.
   - Le traitement est idempotent : une facture déjà traitée n'est pas rejouée.
3. **Retour sur « Mon abonnement »** : `GET /subscription` relit chez GeniusPay le paiement en attente, au plus une fois toutes les 5 s par facture (l'écran relit toutes les 2 s pendant l'attente). Le paiement est donc reconnu même si le webhook n'est pas encore arrivé, ou ne peut pas arriver (développement en `localhost`). C'est le serveur qui interroge GeniusPay : la redirection du navigateur ne valide rien (ADR-003).

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `Gstock-plateform/app/Domain/Platform/Billing/PlatformGateway.php` | Interface : `checkout()` → `CheckoutSession` (adresse + référence), `find()` → `GatewayPayment` (issue, moyen, montant). |
| `…/Billing/GeniusPayPlatformGateway.php` | Pilote réel : appels à l'API marchand (en-têtes `X-API-Key`, `X-API-Secret`), statuts traduits, nom du moyen de paiement, déclaration des webhooks. |
| `…/Billing/GeniusPayWebhook.php` | Signature et fraîcheur du webhook ; événement traduit en issue. Remplace `WebhookSignature.php` (format provisoire de B8). |
| `…/Billing/SubscriptionService.php` | `checkout()`, `handleWebhook()`, `refreshPending()`, `settle()` (point unique qui applique un paiement : prolongation, facture payée ou échouée). |
| `…/Billing/SimulatedPlatformGateway.php`, `app/Http/Controllers/GeniusPaySimulationController.php` | Page simulée (sans clés, hors production), qui passe maintenant par `settle()`. |
| `app/Console/Commands/RegisterGeniusPayWebhook.php` | `php artisan gstock:geniuspay-webhook <url>` déclare le webhook et affiche son secret ; `--list` affiche les webhooks déjà déclarés. |
| `app/Providers/AppServiceProvider.php` | Choix du pilote : `geniuspay`, ou `simulation` (refusée en production). |
| `config/gstock.php`, `.env.example`, `compose.yaml`, `../docker-compose.coolify.yml`, `phpunit.xml` | Variables `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET`, `GENIUSPAY_BASE_URL` (facultative) et `GENIUSPAY_PLATFORM_DRIVER` (facultative). |

## Configuration

| Variable | Rôle |
|---|---|
| `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET` | Clés du compte GeniusPay de Genius Groups (dashboard > Paramètres > API). Avec des clés, le pilote réel est choisi automatiquement. `sk_sandbox_…` = test, `sk_live_…` = paiements réels. |
| `GENIUSPAY_WEBHOOK_SECRET` | Secret `whsec_…` donné **une seule fois** à la création du webhook (`gstock:geniuspay-webhook`). Sans lui, tout webhook est refusé, et seule la relecture au retour sur « Mon abonnement » valide les paiements. |
| `GENIUSPAY_PLATFORM_DRIVER` | Facultative. `simulation` force la page simulée (refusée en production). Le compose Coolify fixe `geniuspay`. |
| `GENIUSPAY_BASE_URL` | Facultative, par défaut `https://pay.genius.ci/api/v1/merchant`. |

Les anciens noms `GENIUSPAY_PLATFORM_API_KEY`, `…_API_SECRET` et `…_WEBHOOK_SECRET` restent lus s'ils sont présents.

## Décisions

| Sujet | Décision |
|---|---|
| Quelle API GeniusPay | Les clés `sk_sandbox_` / `ss_sandbox_` sont refusées par `api.geniuspay.ci/v2`, décrite par le serveur MCP GeniusPay et par `docs.geniuspay.ci`. Elles sont acceptées par l'**API marchand v1** `pay.genius.ci/api/v1/merchant` (doc : `https://pay.genius.ci/docs/api`). Le pilote suit donc cette dernière. |
| Mode de paiement | Page de paiement hébergée par GeniusPay : aucun moyen de paiement à gérer côté GStock. |
| Validation | Webhook signé **et** confirmé par relecture chez GeniusPay ; relecture aussi au retour sur « Mon abonnement ». Jamais sur la seule redirection du navigateur. |
| Montant | Un montant payé inférieur à la facture ne prolonge pas l'abonnement : la facture reste en attente et l'écart est journalisé pour Genius Groups. |
| Facture abandonnée puis payée | Une facture remplacée par un nouveau paiement est en `failed`. Si GeniusPay la confirme payée quand même, rien n'est prolongé automatiquement, et une erreur est journalisée pour un traitement à la main. |
| Signature | Calculée sur le corps brut, ou sur sa réécriture par `json_encode` : la doc de GeniusPay signe `json_encode($payload)`. |

## Vérifications

- Paiement réel créé dans le sandbox GeniusPay avec les clés du `.env` (page `https://geniuspay.ci/checkout/SANDBOX_…`), puis relu par sa référence (statut `pending`, montant 5 000).
- `gstock:geniuspay-webhook --list` interroge le compte sandbox : un webhook déjà déclaré, étranger à GStock (adresse ngrok, `payment.success` seul).
- `SubscriptionTest` (API GeniusPay simulée par `Http::fake`) couvre :
  - le lancement du paiement (en-têtes, montant, métadonnées, adresse de retour) et le refus de GeniusPay (502, facture non laissée en attente) ;
  - un webhook mal signé ou trop ancien (401) ;
  - les événements sans conséquence, l'échec, l'autre environnement ;
  - un succès non encore confirmé par GeniusPay, un montant inférieur à la facture ;
  - la prolongation unique (rejeu sans effet) ;
  - la relecture au retour et sa limitation à une fois toutes les 5 s ;
  - l'espace suspendu qui paie ;
  - la page simulée.
- `composer test` : 118 tests passés ; `pint` sans remarque.

## Limites

- **Webhook non testé de bout en bout** : il faut une adresse publique. À faire au déploiement : `gstock:geniuspay-webhook https://<domaine>/api/v1/webhooks/geniuspay/platform`, puis un paiement sandbox. Le nom du champ du secret dans la réponse de création n'est pas documenté : la commande essaie `secret`, `webhook_secret` et `signing_secret`, sinon elle affiche la réponse entière.
- **Paiement abandonné** : si le commerçant ferme la page GeniusPay sans payer ni annuler, la facture reste « en attente », et le bouton « Payer » reste masqué jusqu'à ce que GeniusPay expire le lien (24 h). Un bouton « Abandonner ce paiement » reste à prévoir.
- **Encaissements des boutiques** par GeniusPay (clés de chaque commerçant, `/webhooks/geniuspay/{tenant}`) : pas encore branchés. Le pilote et la vérification du webhook pourront être repris.
