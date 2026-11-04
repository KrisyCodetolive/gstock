# B4 — Clients, caisse et ventes (backend)

> **Statut : terminée** (branche `api-clients-ventes`).
> Étape 4 du planning (§15) : M10 « Mes clients » et M08 « Ventes / Point de vente ». Contexte Ventes en DDD complet (ADR-001).

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `db83ddb` | Clients ; calculateur de vente ; enregistrement (stock, paiements, crédit client automatique) ; annulation motivée ; données de la caisse ; historique avec totaux ; reçus et liens signés ; reçu public ; 30 clients et ~280 ventes de démonstration ; 10 tests. |

## Endpoints

Sous `/api/v1`, sur le sous-domaine de l'espace. Formes JSON identiques à `Gstock-frontend/src/types/customers.ts` et `sales.ts`.

| Endpoint | Permission |
|---|---|
| `GET /customers` (`search`, `filter[is_active]`, `filter[has_balance]`), `GET /customers/{id}` | `customers.view` ou `sales.create` |
| `GET /customers/{id}/summary` (soldes par boutique, achats, ventes récentes, crédits) | `customers.view` |
| `POST /customers` (nom seul obligatoire), `PUT /customers/{id}` (pas de suppression) | `customers.create` / `customers.update` |
| `GET /shops/{id}/pos/bootstrap` (articles, catégories, modes de paiement, clients et soldes) | `sales.create` |
| `POST /shops/{id}/sales/quote` (calcul sans enregistrer) | `sales.create` |
| `POST /shops/{id}/sales` (`offline_uuid` idempotent) | `sales.create` (+ `credits.create`, `sales.edit_price`, `sales.give_discount` selon le panier) |
| `GET /shops/{id}/sales` (`search`, `filter[payment_status|status|sync_status|customer_id|user_id|from|to]`, `summary`) | `sales.view` |
| `GET /shops/{id}/sales/{id}`, `GET …/receipt`, `POST …/share-link` | `sales.view` ou `sales.create` |
| `POST /shops/{id}/sales/{id}/cancel` (`reason` obligatoire) | `sales.cancel` |
| `GET /public/receipts/{token}` (sans connexion) | lien signé |

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_11_05_000300_create_customers_and_sales_tables.php` | `customers`, `sales`, `sale_items`, `sale_payments`, `customer_credits` ; clé étrangère `shops.default_customer_id`. |
| `app/Domain/Sales/SaleCalculator.php`, `SaleComputation.php` | **Calcul de référence** (§7.4, §7.5) : prix, remise (pourcentage ou fixe), taxe exclusive, remise globale, paiements, rendu sur les espèces, reste à crédit, statut. Décimal exact. Sert au devis et à l'enregistrement. |
| `app/Domain/Sales/SaleService.php` | Enregistrement dans une transaction : référence `V-N`, lignes, sortie du stock par `StockLedger`, paiements, crédit client. Annulation : stock restitué, paiements et crédit annulés, journal. |
| `app/Domain/Sales/ReceiptLinks.php` | Jetons de reçu signés (HMAC avec la clé de l'application), valables 7 jours, liés à l'espace. |
| `app/Http/Resources/SalesPresenter.php` | Formes JSON des clients, crédits, ventes, reçus. |
| `app/Http/Controllers/Api/V1/CustomerController.php`, `SaleController.php`, `PublicReceiptController.php` | Endpoints. |
| `database/seeders/DemoSalesSeeder.php` | 30 clients et environ 30 jours de ventes (espèces, Mobile Money, en partie ou entièrement à crédit), enregistrées par le vrai moteur. |

## Règles du cahier appliquées

- **§7.4** : tous les montants sont recalculés par le serveur ; un prix envoyé différent du prix du catalogue exige `sales.edit_price` (403 sinon), une remise exige `sales.give_discount` ; remise globale plafonnée au total ; arrondis à 2 décimales.
- **§7.5** : payé immédiatement = somme des paiements ; rendu calculé sur les espèces seulement, jamais compté comme argent reçu ; argent reçu supérieur au total refusé ; **montant à crédit = total − payé** ; statut `paid`, `partial` ou `credit`.
- **§7.1** : le stock sort dès la validation, payée ou à crédit (mouvement `sale`) ; un reste à payer exige un client identifiable et la permission `credits.create` ; le crédit client est créé automatiquement, avec la même référence que la vente.
- **§7.2** : stock insuffisant → toute la vente est refusée, rien n'est écrit (pas même le numéro `V-N`).
- **ADR-012** : une vente ne se supprime ni ne se modifie ; elle s'annule avec un motif ; stock restitué (mouvement `sale_cancel`), paiements et crédit annulés ; double annulation : 409 ; journal `sale.cancelled`.
- **ADR-005** : `offline_uuid` idempotent ; le moteur sait déjà enregistrer une vente faite hors ligne (prix de l'appareil, stock jamais négatif, écart « à vérifier ») pour la synchronisation de l'étape 7.
- **ADR-003** : un paiement par un mode GeniusPay reste `pending` si GeniusPay est actif dans l'espace (validation au webhook : étape 6).
- **ADR-013** : reçu partagé par un lien signé, valable 7 jours, lié à l'espace ; reçu public sans connexion ; lien faux ou d'un autre espace : 404 ; lien expiré : 410.
- **§6.2** : affectation à la boutique vérifiée ; sans `records.view_all`, on ne voit que ses propres ventes ; soldes clients calculés sur les boutiques visibles.
- **M14** : prix modifié à la caisse journalisé (`sale.price_changed`).

## Décisions prises pendant la phase

- **Annulation d'une vente dont le crédit a déjà reçu un paiement** : refusée (409) pour l'instant. Le choix « avoir ou argent rendu » (décision P3) arrivera avec les paiements de crédit (B5).
- **Avoirs** : `credit_note_balance` vaut 0 et un paiement par avoir est refusé (« L'avoir du client n'est que de 0 FCFA. ») jusqu'au module Crédits.
- **Numéro `V-N` pris dans la transaction** : un refus ne laisse pas de trou dans la numérotation.
- **Historique de démonstration** généré par le vrai moteur (aléatoire à graine fixe), plutôt que copié : il respecte toutes les règles du serveur.
- **Message de partage** identique aux données simulées : « Bonjour, voici votre reçu V-12 de Alimentation Koné (4500 FCFA) : lien ».

## Vérifications faites

- **57 tests passent** (455 assertions), dont 10 nouveaux : calcul complet d'un devis (remises en pourcentage et fixe, remise globale, rendu, reste à crédit), vente en espèces (stock, rendu non compté), crédit automatique et solde du client, permissions (crédit, prix, remise), vente refusée en entier sur stock insuffisant sans consommer de numéro, idempotence, annulation (motif, stock, crédit, 409, journal), historique (totaux hors annulées, recherche, filtres, visibilité de ses ventes), reçus (lien signé, faux, d'un autre espace, expiré), variantes et données de la caisse.
- **Données de démonstration** : 277 ventes, 38 crédits, aucun écart entre le stock et la somme des mouvements.
- **Navigateur** (frontend en `dev:api`) : caisse avec total calculé par le serveur, encaissement avec rendu, vente `V-278` enregistrée, vente à crédit pour un client, historique, annulation motivée, reçu, liste des clients.
- `vendor/bin/pint --test` passe.

## Limites

- Paiements de crédit, anciennes dettes, échéanciers, régularisations, avoirs et décision P3 : module Crédits (B5).
- GeniusPay : les paiements restent `pending` sans webhook (étape 6). La démo n'active pas GeniusPay.
- Synchronisation hors ligne (`POST /shops/{id}/sync`) : étape 7, le moteur est prêt.
- La caisse charge tout le catalogue et tous les clients de l'espace à chaque `pos/bootstrap` : à surveiller pour les gros espaces.
