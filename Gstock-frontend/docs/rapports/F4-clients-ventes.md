# F4 — Clients et ventes

> **Statut : terminée** (branche `front-ventes`, fusionnée dans `main` au commit `b2055f3`).
> Livrable du cahier (§11.4) : « Vente payée, mixte, à crédit ». Modules M10, M08 (en ligne).

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `a96f276` | Pages chargées à la demande (`lazy` dans `src/app/router.tsx`) : fichier principal de 903 à 480 Ko. |
| `7f92616` | **Moteur de vente simulé** (`src/mocks/sales.ts`) et historique de démonstration (`src/mocks/data/sales-seed.ts`). |
| `baec1b2` | Mes clients (M10). |
| `b2d897a` | Caisse plein écran (M08). |
| `b83990f` | Mes ventes, reçus 58/80 mm, partage WhatsApp par lien expirant (M08). |

## Jeu de démonstration

- 30 clients (`src/mocks/data/customers.ts`) et 3 anciennes dettes (soldes initiaux `CR-1` à `CR-3`).
- Environ 280 ventes sur un mois, générées par `seedHistory()` **avec le même moteur que la caisse** (`recordSale`) : stock, mouvements et crédits sont donc cohérents. Environ 45 ventes ont un reste à payer, réparties sur 15 clients. Le générateur est déterministe (même démo à chaque remise à zéro) et ne vend jamais sous le seuil d'alerte.
- L'historique est généré au démarrage des mocks (`src/mocks/browser.ts`) et après une remise à zéro (`db.seeded`).

## M10 — Mes clients

| Adresse | Écran | Permission |
|---|---|---|
| `/clients` | Liste avec reste à payer, filtre « Doivent de l'argent » | `customers.view` |
| `/clients/nouveau` | Création (nom seul obligatoire) | `customers.create` |
| `/clients/:id` | Fiche : reste à payer (total et par boutique), achats, crédits avec état, derniers achats, modification, désactivation | `customers.view` (modifier : `customers.update`) |

- **Fichiers** : `src/features/customers/` (`CustomerFields.tsx` est réutilisé par la création rapide de la caisse), `src/types/customers.ts`, `src/lib/api/customers.ts`, `src/mocks/handlers/customers.ts`.
- **Endpoints** : `GET|POST /customers` (filtres `has_balance`, `is_active`), `GET|PUT /customers/{id}`, `GET /customers/{id}/summary`.
- **Règles** : clients communs à l'espace ; soldes calculés sur les boutiques visibles par l'utilisateur ; téléphone unique ; un client désactivé garde sa dette.
- **Limites** : « Enregistrer un remboursement » mène à `/credits?client=…`, encore « Bientôt disponible » (**à brancher en F5**).

## M08 — Caisse

| Adresse | Écran | Permission |
|---|---|---|
| `/vendre` | Caisse plein écran (hors mise en page habituelle) | `sales.create` |

- **Fichiers** : `src/features/pos/` — `store.ts` (panier Zustand par boutique, persisté sous `gstock.pos`, paniers en attente), `hooks.ts` (`usePosBootstrap`, `useSaleQuote`, `useCreateSale`, `useSaleConfirmation`), `components/ProductGrid.tsx`, `CartPanel.tsx`, `LineEditor.tsx` (prix et remise d'une ligne), `CheckoutSheet.tsx` (encaissement), `CustomerPicker.tsx` (choix et création rapide du client), `pages/PosPage.tsx`.
- **Parcours** : recherche (une douchette qui envoie un code-barres + Entrée ajoute le produit), catégories, grille ; panier à droite (desktop) ou bandeau en bas (mobile) ; « Encaisser » (espèces avec boutons de billets et rendu, paiement mixte) ; « Mettre à crédit » (client obligatoire, paiement partiel possible) ; « Mettre en attente » / « Reprendre » ; écran de fin (rendu à donner, montant mis à crédit, reçu, nouvelle vente).
- **Le total n'est jamais calculé par le navigateur** : `useSaleQuote` appelle `POST /shops/{id}/sales/quote` (150 ms après chaque changement) et affiche le résultat ; l'encaissement fait de même avec les paiements pour obtenir argent reçu, reste et rendu.

## M08 — Mes ventes et reçus

| Adresse | Écran | Permission |
|---|---|---|
| `/ventes` | Historique : périodes, filtres paiement / vendeur / client (`?client=`), totaux de la période | `sales.view` |
| `/ventes/:id` | Détail, paiements (avec « en attente GeniusPay »), annulation avec motif | `sales.view` (annuler : `sales.cancel`) |
| `/ventes/:id/recu` | Reçu 58 ou 80 mm, impression, partage WhatsApp, copie du lien | `sales.view` ou `sales.create` |
| `/recu/:token` | **Reçu public** ouvert par le client, sans connexion | aucune (lien signé) |

- **Fichiers** : `src/features/sales/` (`ReceiptTicket.tsx`, `PaymentStatusBadge.tsx`), `src/components/CancelDialog.tsx` (annulation avec motif obligatoire, aussi utilisée par le stock), styles d'impression à la fin de `src/index.css`.

## Endpoints (F4)

`GET /shops/{id}/pos/bootstrap`, `POST /shops/{id}/sales/quote`, `POST /shops/{id}/sales`, `GET /shops/{id}/sales` (filtres `from`, `to`, `payment_status`, `status`, `user_id`, `customer_id` ; avec `summary`), `GET /shops/{id}/sales/{id}`, `POST /shops/{id}/sales/{id}/cancel`, `GET /shops/{id}/sales/{id}/receipt`, `POST /shops/{id}/sales/{id}/share-link`, `GET /public/receipts/{token}`.

## Le moteur de vente (`src/mocks/sales.ts`)

- `computeSale(input, user)` : calcul du §7.4 (prix ou prix modifié, remise par ligne en `%` ou montant par unité, taxe exclusive en mode avancé, remise globale, paiements, rendu sur les espèces, `crédit = total − payé`, statut `paid` / `partial` / `credit`). Vérifie les permissions de remise et de prix.
- `recordSale(shopId, user, input, date?)` : refuse un reste sans client ou sans `credits.create` ; sort le stock via `applyStockChanges` ; référence `V-N` ; paiements `pending` si GeniusPay est actif ; **crédit client créé automatiquement** (référence = celle de la vente).
- `cancelSale(sale, user, reason)` : stock restitué, paiements et crédit annulés ; **refusée (409) si le crédit a déjà reçu un remboursement** (en attendant la décision P3, voir F5).
- `customerBalance(customerId, shopIds?)` : Σ des restes des crédits non annulés (§7.6).

## Règles appliquées

§7.1 (stock diminué dès la validation, client obligatoire pour un reste), §7.4 (montants recalculés par le serveur), §7.5 (crédit automatique, rendu jamais compté comme argent reçu), §7.2 (impossible d'ajouter au panier plus que le stock), ADR-003 (paiement GeniusPay validé au webhook, simulé ici par une confirmation après 4 s), ADR-005 (`offline_uuid` idempotent), ADR-012 (annulation motivée, jamais de suppression), ADR-013 (lien de reçu signé valable 7 jours, partage `wa.me` déclenché par le commerçant), §6.2 (sans `records.view_all`, on ne voit que ses ventes).

## Vérifications faites

Navigateur, mobile et desktop : ajout au panier en **132 ms** (exigence : < 200 ms) ; vente en espèces avec rendu en ~3 s ; ajout bloqué au-delà du stock ; crédit sans client impossible puis créé avec le client ; vente entièrement à crédit avec création rapide du client ; panier mis en attente puis repris ; annulation motivée et reçu « VENTE ANNULÉE » ; message WhatsApp pré-rempli ; reçu public lisible sans connexion et lien invalide refusé ; vendeur limité à ses ventes et sans bouton d'annulation. Contrôle de la base : chaque reste à payer a son crédit, `total = payé + crédit` pour chaque vente, aucun écart de stock.

## Limites

- Pas de mode hors ligne (F9).
- GeniusPay simulé : pas de cas d'échec de paiement.
- Paniers en attente gardés sur l'appareil, pas sur le serveur (choix assumé, compatible avec le hors ligne).
- Pas de scan par la caméra du téléphone.
