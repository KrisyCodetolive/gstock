# F6 — Approvisionnements et dépenses

> **Statut : terminée** (branche `front-achats`).
> Livrable du cahier (§11.4) : « Entrées de stock et sorties d'argent ». Modules M11, M12.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `f5677fd` | **Moteur simulé** (`src/mocks/purchases.ts`) : approvisionnements `AP-N` (entrée en stock, mise à jour des prix d'achat, paiements, annulation), dépenses `DP-N` ; fournisseurs ; endpoints simulés ; approvisionnements et dépenses dans la démo. |
| `6b5c2cc` | Écrans : approvisionnements (liste, saisie, fiche, paiement fournisseur, annulation), fournisseurs (liste, fiche, création), dépenses (liste, saisie, détail, annulation). Les mouvements de stock renvoient vers leur approvisionnement ou leur vente. |

Jeu de démonstration : 5 fournisseurs (`src/mocks/data/purchases.ts`), 6 approvisionnements en octobre (dont certains payés en partie ou pas du tout) et 12 dépenses (loyers, électricité, transport, internet, personnel…), créés par les moteurs dans `src/mocks/data/sales-seed.ts`. La clé de la base simulée passe à `gstock.mock.db.v5`.

## Écrans

| Adresse | Écran | Permission |
|---|---|---|
| `/approvisionnements` | Liste filtrable par paiement, totaux (acheté, payé, reste à payer) | `purchases.view` |
| `/approvisionnements/nouveau` | Fournisseur facultatif, date, lignes produit / quantité / prix d'achat, total calculé par le serveur, remise, « mettre à jour le prix d'achat des produits », paiement immédiat facultatif | `purchases.create` (payer : `purchase_payments.create`) |
| `/approvisionnements/:id` | Fiche : produits reçus, total, payé, reste dû, paiements ; « Payer le fournisseur » ; annulation motivée | `purchases.view` (payer : `purchase_payments.create`, annuler : `purchases.cancel`) |
| `/fournisseurs` | Liste avec total acheté, payé, dû ; filtre « Je leur dois » | `suppliers.view` |
| `/fournisseurs/nouveau`, `/fournisseurs/:id` | Création ; fiche (totaux, approvisionnements dans la boutique courante, modification, désactivation) | `suppliers.view` (modifier : `suppliers.manage`) |
| `/depenses` | Périodes, filtre par catégorie, total et répartition par catégorie, liste ; saisie et détail en panneau ; annulation motivée | `expenses.view` (saisir : `expenses.create`, annuler : `expenses.cancel`) |

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/mocks/purchases.ts` | Moteur : `computePurchase`, `recordPurchase`, `addPurchasePayment`, `cancelPurchase`, `purchaseState`, `recordExpense`, `cancelExpense`. |
| `src/mocks/handlers/purchases.ts` | Endpoints simulés (fournisseurs, approvisionnements, dépenses). |
| `src/types/purchases.ts`, `src/lib/api/purchases.ts` | Contrat et appels. |
| `src/features/purchases/` | `hooks.ts` (dont `usePurchaseQuote`), `pages/` (PurchasesListPage, PurchaseFormPage, PurchaseDetailPage, SuppliersListPage, SupplierPage, ExpensesPage), `components/PurchaseStatusBadge.tsx`. |
| `src/features/stock/components/MovementsPreview.tsx` | Un mouvement d'approvisionnement ou de vente ouvre maintenant son opération. |

## Endpoints

Prévus par le cahier : `CRUD /suppliers` (sans suppression : désactivation), `GET|POST /shops/{id}/purchases`, `GET /shops/{id}/purchases/{id}`, `POST /shops/{id}/purchases/{id}/cancel`, `POST /shops/{id}/purchases/{id}/payments`, `GET|POST /shops/{id}/expenses`, `POST /shops/{id}/expenses/{id}/cancel`.

**Ajoutés** (à reporter dans le cahier) :
- `POST /shops/{id}/purchases/quote` (total calculé sans enregistrer, comme pour les ventes) ;
- `POST /shops/{id}/purchases` accepte `paid_amount`, `payment_method_id`, `update_costs` ;
- champs `summary` dans les listes d'approvisionnements (total, payé, dû) et de dépenses (total, répartition par catégorie) ;
- `purchased_total`, `paid_total`, `due_total` sur le fournisseur ; filtre `has_due` ;
- `POST /shops/{id}/expenses` accepte `offline_uuid`.

## Règles appliquées

- Approvisionnement : **le stock augmente à l'enregistrement**, en unité de base, via `applyStockChanges` (mouvement `purchase`) ; montants recalculés par le serveur (§7.4) ; prix d'achat des produits mis à jour si demandé.
- Paiement au fournisseur (à l'enregistrement ou plus tard) jamais supérieur au reste dû ; statuts `paid`, `partial`, `unpaid`.
- **Annulation d'un approvisionnement** : motif obligatoire, la marchandise ressort du stock (mouvement `purchase_cancel`), **refusée si le stock deviendrait négatif** (marchandise déjà vendue, §7.2) ; l'approvisionnement reste visible, marqué « annulé ».
- Dépense : catégorie, montant, mode de paiement obligatoires ; date non future ; `DP-N` par espace ; annulation motivée ; `offline_uuid` idempotent.
- Fournisseurs communs à l'espace ; leurs totaux portent sur les boutiques visibles par l'utilisateur.
- Sans `records.view_all`, on ne voit que ses propres approvisionnements et dépenses.

## Vérifications faites

- **Appels directs** : approvisionnement → stock de 3 à 13 et prix d'achat mis à jour ; paiement supérieur au reste dû refusé ; annulation refusée après la vente de la marchandise (« Stock insuffisant : il reste 2 btl ») ; dépenses totalisées par catégorie ; double envoi d'une dépense → une seule `DP-N` ; validation 422 en français.
- **Navigateur** : approvisionnement de **5 produits en 9 secondes** (exigence : moins d'une minute) par le gestionnaire de stock, stock de 82 à 106 ; la section de paiement est masquée pour lui (pas de `purchase_payments.create`) ; paiement du fournisseur ; filtre « Je leur dois » ; création d'un fournisseur ; dépense (erreurs, saisie, annulation) ; le vendeur n'a pas accès aux dépenses ; liens des mouvements vers `AP-1` et vers les ventes.
- Tous les scénarios de F1 à F5 repassent ; démo cohérente (aucun écart de stock ni de crédit).

## Limites

- Pas d'échéancier sur les dettes fournisseurs (prévu par le cahier comme facultatif ; à ajouter en réutilisant la logique de F5).
- Pas d'unité d'achat différente de l'unité de base (mode avancé, §7.3) : les quantités sont saisies en unité de base.
- L'annulation d'un approvisionnement ne touche pas aux paiements déjà faits au fournisseur (pas de remboursement fournisseur enregistré).
- Pas de journal d'audit (M14, F7).
