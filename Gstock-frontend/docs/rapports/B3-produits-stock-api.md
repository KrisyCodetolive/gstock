# B3 — Produits et stock (backend)

> **Statut : terminée** (branche `api-produits-stock`).
> Étape 4 du planning (§15) : M06 « Mes produits » et M07 « Mon stock ». Premier contexte en DDD complet (ADR-001).

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `f97e9db` | Catalogue (produits, variantes, unité d'achat, photo, recherche par article), moteur de stock (`StockLedger`), mouvements manuels `MS-N` annulables, vues du stock (boutique, alertes, toutes les boutiques, historique), contrôle d'accès aux boutiques, catalogue de démonstration identique aux données simulées, 14 tests. |

## Endpoints

Sous `/api/v1`, sur le sous-domaine de l'espace. Formes JSON identiques à `Gstock-frontend/src/types/catalog.ts` et `stock.ts`.

| Endpoint | Permission |
|---|---|
| `GET /products` (`?shop_id=` ajoute le stock de la boutique ; `search`, `filter[category_id]`, `filter[is_active]`, `sort=name`) | `products.view` |
| `GET /products/{id}`, `GET /products/{id}/stock` | `products.view` |
| `POST /products` (`initial_quantity` et `shop_id` facultatifs) | `products.create` (+ `stock.entry` pour la quantité de départ) |
| `PUT /products/{id}` (pas de suppression) | `products.update` ; désactiver : `products.disable` |
| `POST|DELETE /products/{id}/image` (multipart `image`) | `products.update` (envoi : aussi `products.create`) |
| `GET /stock` (toutes mes boutiques) | `stock.view` |
| `GET /shops/{id}/products/search?q=&services=` (une entrée par variante ; un code-barres exact ne renvoie que son article) | affectation à la boutique |
| `GET /shops/{id}/stock`, `GET /shops/{id}/stock/alerts` (avec `summary`), `GET /shops/{id}/stock/movements?product_id=` | `stock.view` |
| `GET /shops/{id}/adjustments/{id}` | `stock.view` |
| `POST /shops/{id}/adjustments` (`kind` : entry, exit, inventory ; `offline_uuid`) | `stock.entry`, `stock.exit` ou `stock.adjust` selon le type |
| `POST /shops/{id}/adjustments/{id}/cancel` (`reason` obligatoire) | `stock.adjust` |

Toutes les routes `/shops/{id}/…` exigent l'affectation de l'utilisateur à la boutique (le propriétaire les a toutes) et une boutique ouverte : sinon 403.

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_11_05_000200_create_catalog_and_stock_tables.php` | `products`, `product_variants`, `shop_stock`, `stock_movements`, `adjustments`, `adjustment_items`. Une ligne de stock unique par (boutique, produit, variante) (`NULLS NOT DISTINCT`), et **`CHECK (quantity >= 0)`** en base. |
| `app/Domain/Stock/StockLedger.php` | **Seul point d'écriture du stock** : regroupe les variations par article, verrouille les lignes (`SELECT … FOR UPDATE`) dans un ordre fixe, refuse tout passage sous zéro avant d'écrire, enregistre les mouvements. |
| `app/Domain/Stock/StockChange.php`, `AdjustmentService.php` | Variation de stock ; mouvements manuels `MS-N` (création, inventaire sur ligne verrouillée, annulation). |
| `app/Domain/Catalog/ProductService.php`, `Article.php` | Règles du catalogue (mêmes messages que les données simulées) ; article = produit simple ou variante active. |
| `app/Http/Resources/CatalogPresenter.php` | Formes JSON du catalogue ; niveaux de stock d'une page chargés en une requête. |
| `app/Http/Controllers/Api/V1/ProductController.php`, `StockController.php`, `AdjustmentController.php` | Endpoints. L'état du stock (rupture, faible, ok) et le solde après chaque mouvement sont calculés par PostgreSQL (`CASE`, fonction de fenêtre). |
| `app/Http/Middleware/RequireShopAccess.php` | Alias `shop` : affectation et boutique ouverte. |
| `app/Support/Decimal.php`, `DocumentSequence.php` | Calcul décimal exact (bcmath) ; références `PRÉFIXE-N` par espace, ligne verrouillée. |
| `database/seeders/DemoCatalogSeeder.php` | 59 produits, un service, « Jus de fruits 1 L » à 3 variantes, stock de départ par mouvements « stock initial ». |

## Règles du cahier appliquées

- **§7.2** : stock tenu par (produit, variante, boutique) en unité de base ; égal à la somme des mouvements ; **jamais négatif** (contrôle en transaction sur des lignes verrouillées, plus une contrainte en base) ; message « Stock insuffisant : il reste 3 u de Huile Dinor 1 L. » ; un service n'a pas de stock ; un produit (ou une variante) créé a une ligne à 0 dans chaque boutique, une boutique créée a une ligne à 0 pour chaque article.
- **§7.9** : références `MS-N` et codes produits `P-NNNN` numérotés par espace, ligne de séquence verrouillée, prise dans la transaction (un échec ne laisse pas de trou).
- **ADR-012** : un mouvement manuel ne se supprime pas ; il s'annule avec un motif, par des mouvements inverses, et l'annulation est refusée si elle rendait le stock négatif ; double annulation : 409.
- **ADR-005** : `offline_uuid` idempotent sur les mouvements manuels.
- **§6.2** : affectation à la boutique vérifiée sur chaque requête ; sans `records.view_all`, on ne voit que ses propres mouvements.
- **M06** : création rapide (nom et prix) ; code généré ; code-barres unique dans l'espace, produits et variantes confondus ; limite du plan (produits actifs) ; désactivation séparée de la modification ; un produit qui a du stock ne devient pas un service ; un produit à variantes le reste ; quantité de départ soumise à `stock.entry`.
- **§7.3** : unité d'achat dérivée de l'unité du produit ; une unité déjà utilisée par des produits garde sa conversion.
- **M05** : `products_count` des catégories et des unités est maintenant calculé.

## Décisions prises pendant la phase

- **Deux garde-fous pour le stock** : le contrôle applicatif sous verrou (message en français), et une contrainte `CHECK` en base au cas où un futur code l'oublierait.
- **Ordre fixe des verrous** (boutique, produit, variante) pour éviter les interblocages entre deux opérations sur les mêmes articles.
- **Inventaire** : l'écart est calculé sur la ligne verrouillée, il reste exact même si une vente a lieu en même temps.
- **Codes produits** `P-0001` par espace, par `document_sequences` (les données simulées utilisaient l'identifiant).
- **Vue « Toutes mes boutiques »** calculée en PHP (catalogue de quelques milliers d'articles au plus) ; la liste du stock d'une boutique, elle, est calculée en SQL.
- **`ListQuery`** accepte une préparation de la page entière (`beforeMap`), pour charger les niveaux de stock en une requête.

## Vérifications faites

- **47 tests passent** (364 assertions), dont 14 nouveaux : création rapide avec code et stock initial, ligne de stock dans chaque boutique, droit d'ajouter du stock, unicité du code et du code-barres (y compris entre produits et variantes), limite du plan, variantes (prix « à partir de », recherche par variante, code-barres exact, variante hors vente, type figé), unité d'achat et conversion figée, permissions de modification et de désactivation, photo, entrées, sorties et inventaires `MS-1…`, solde après chaque mouvement, refus du stock négatif sans rien écrire, annulation (motif, inverse, refus si négatif, 409), idempotence hors ligne, permission par type, visibilité de ses propres mouvements, accès aux boutiques (non affectée, fermée), nouvelle boutique à 0, totaux et alertes de la liste, vue toutes boutiques. Chaque test vérifie que **stock = somme des mouvements**.
- **Concurrence réelle** : 10 sorties de 5 lancées en même temps sur un stock de 24 (serveur à 6 processus) : 4 acceptées, 6 refusées (« il reste 4 u »), stock final 4 égal à la somme des mouvements, références `MS-1` à `MS-4` sans trou.
- **Navigateur** (frontend en `dev:api`) : catalogue de démonstration, produit à variantes, création d'un produit (code `P-0062`), Mon stock, sortie de stock `MS-1`, historique des mouvements.
- `vendor/bin/pint --test` passe.

## Limites

- Les mouvements `sale`, `purchase` et leurs annulations arriveront avec les ventes et les approvisionnements : le registre est prêt.
- Pas de surcharge du seuil d'alerte par boutique à l'écran (la colonne existe).
- Unité de vente différente de l'unité de base : non gérée (comme dans le frontend).
- Les photos du catalogue de démonstration (illustrations SVG du frontend) ne sont pas reprises côté serveur.
- La recherche de la caisse filtre en PHP sur le catalogue entier de l'espace : à revoir si un espace dépasse quelques milliers de produits.
