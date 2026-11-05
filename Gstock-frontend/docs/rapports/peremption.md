# Dates de péremption (backend et frontend)

| | |
|---|---|
| **Statut** | Livrée le 5 novembre 2026 |
| **Branche** | `peremption` (précédée de `cahier-peremption` et `front-stock-produit`) |
| **Cahier** | §7.11 (nouveau), §7.2, §7.8, §8.4, §8.7, M06, M07, M08, M11, M13, P12, P13 — version 3.1 |

Développée directement contre le backend, sans données simulées (à la demande du propriétaire du projet) : le mode simulé n'a pas ces fonctions.

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier): dates de péremption par arrivage (§7.11)…` | règles décidées avec le propriétaire (branche `cahier-peremption`) |
| `feat(front): stock géré depuis le produit…` | quantité en stock visible à la création, Ajouter / Retirer / Corriger après comptage sur la fiche (branche `front-stock-produit`) |
| `feat(api): dates de péremption par arrivage…` | arrivages, endpoints, tableau de bord, tests |
| `feat(front): dates de péremption…` | écrans |

## Écrans

| Écran | Adresse | Permission |
|---|---|---|
| Interrupteur « Suivre les dates de péremption », délai d'alerte, date de la quantité initiale | `/produits/nouveau`, `/produits/:id` | `products.create` / `products.update` (date : `stock.entry`) |
| Stock par date : liste des arrivages, date à indiquer ou corriger, retrait d'un arrivage périmé | `/produits/:id` | `stock.view` (date : `stock.adjust`, retrait : `stock.exit`) |
| Ajouter / Retirer du stock / Corriger après comptage depuis la fiche (panneau) | `/produits/:id` | `stock.entry`, `stock.exit`, `stock.adjust` |
| Date par ligne (entrée, inventaire) ; motif de sortie choisi dans la liste | `/stock/entree`, `/stock/sortie`, `/stock/inventaire` | idem |
| Date par ligne d'approvisionnement | `/approvisionnements/nouveau` | `purchases.create` |
| Tuiles et filtres « Périmés », « Bientôt périmés », indication sur chaque ligne | `/stock?state=expired|soon` | `stock.view` |
| Alerte au premier ajout au panier d'un produit qui a du périmé (vente possible) | `/vendre` | `sales.create` |
| Carte « Péremption », pertes de la période ; ligne « Pertes » sous le résultat estimé | `/` | `stock.view` |
| Délai d'alerte de l'espace | `/parametres/espace` | `settings.manage` |

## Fichiers clés et endpoints

- Backend : migration `2026_11_08_000100_create_stock_lots_tables.php` ; `app/Domain/Stock/StockLots.php` (répartition sur les arrivages, appelée par `StockLedger::apply()` sous le verrou de la ligne `shop_stock`), `Expiry.php` (aujourd'hui, délai, état, résumé), modèles `StockLot`, `StockLotMovement` ; `AdjustmentService` (`exit_reason`, `expiry_date`, `stock_lot_id`) ; `PurchaseService` (`expiry_date`) ; `ProductService` (`track_expiry`, `expiry_alert_days`, `initial_expiry_date`, début du suivi) ; `StockController` (`expiry` par ligne, `filter[expiry]`, `summary.expired|soon`, arrivages) ; `DashboardService` (`expiry`, `losses`) ; `tests/Feature/ExpiryTest.php`.
- Frontend : `src/features/stock/components/ProductLotsSection.tsx`, `StockQuickSheet.tsx`, `ExpiryBadge.tsx`, `src/features/stock/reasons.ts` ; types dans `src/types/{catalog,stock,dashboard,purchases,sales,settings}.ts`.
- Endpoints ajoutés : `GET /shops/{id}/stock/lots?product_id=&variant_id=`, `PUT /shops/{id}/stock/lots/{id}` ; champs ajoutés : `track_expiry`, `expiry_alert_days`, `initial_expiry_date` (produit), `expiry` (stock, recherche, `pos/bootstrap`), `summary.expired|soon`, `exit_reason` et `items[].expiry_date|stock_lot_id` (mouvements), `items[].expiry_date` (approvisionnements), `expiry` et `losses` (tableau de bord), `expiry_alert_days` (paramètres) ; action de journal `stock.lot_dated`.

## Règles appliquées (§7.11)

- Somme des arrivages = `shop_stock.quantity` ; aucun arrivage négatif (contrainte en base).
- Sortie : date la plus proche, puis sans date ; à date égale, le plus ancien arrivage. Annulation : chaque quantité retourne dans son arrivage d'origine.
- Annulation d'un approvisionnement dont un arrivage est entamé : refusée (422).
- Périmé dès le jour de la date ; bientôt périmé dans le délai du produit, sinon celui de l'espace (7 jours).
- Pertes = sorties « périmé », « cassé », « volé » au prix d'achat ; ni dépense ni déduites du résultat estimé.

## Décisions prises pendant la phase

- Arrivages tenus seulement pour les produits suivis ; à l'activation, le stock présent devient un arrivage sans date ; une réactivation repart de zéro (anciennes dates perdues).
- Deux lignes d'un même article permises si leurs dates diffèrent (entrée, approvisionnement) ou si elles visent deux arrivages (sortie) ; l'écran n'en propose qu'une par article.
- « Aujourd'hui » au fuseau `Africa/Abidjan`, comme le tableau de bord.
- Unité par défaut d'un nouveau produit : l'écran suit la règle du serveur (unité de base au plus petit identifiant).

## Vérifications

- Backend : 103 tests passent, dont 6 sur la péremption (ordre de sortie, annulations, pertes, approvisionnement entamé, début du suivi, filtres, caisse, inventaire).
- Frontend : `typecheck`, `lint`, `build`.
- Navigateur (Chrome, mobile, contre l'API locale) : création d'un produit suivi avec du périmé, ajout daté, retrait de l'arrivage périmé, filtre « Bientôt périmés », carte du tableau de bord, alerte à la caisse.

## Limites

- Données simulées non mises à jour (elles sont retirées à l'étape suivante).
- Pas d'alerte envoyée hors de l'application (P13).
- Si le stock total ne suffit pas, l'annulation d'un approvisionnement affiche « Stock insuffisant » plutôt que le message de l'arrivage entamé.
