# F3 — Produits et stock

> **Statut : terminée** (branche `front-produits`, fusionnée dans `main` au commit `a399027`).
> Livrable du cahier (§11.4) : « Catalogue et stock utilisables ». Modules M06, M07.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `f3bc112` | Mes produits, et le **moteur de stock simulé** (`src/mocks/stock.ts`). |
| `f5f7202` | Mon stock : vue boutique et toutes boutiques, entrées, sorties, inventaire `MS-N`, mouvements, annulation. |

Jeu de démonstration (`src/mocks/data/products.ts`) : 60 produits du quotidien répartis en 8 catégories, et 1 service (« Livraison à domicile »). Le stock de départ est créé par des mouvements « Stock initial » datés du 1er octobre. Quelques produits sont volontairement faibles ou en rupture (`STOCK_FIXED`) pour illustrer les alertes ; l'historique de ventes de F4 ne les touche pas.

## M06 — Mes produits

| Adresse | Écran | Permission |
|---|---|---|
| `/produits` | Liste : recherche nom / code / code-barres, filtre catégorie, prix, quantité et état dans la boutique courante | `products.view` |
| `/produits/nouveau` | Création rapide : **nom et prix seuls obligatoires**, le reste replié (« Plus de détails ») | `products.create` |
| `/produits/:id` | Fiche : modification, stock par boutique, derniers mouvements, désactivation | `products.view` (modifier : `products.update`) |

- **Fichiers** : `src/features/products/` (dont `ProductPicker.tsx`, `ProductThumb.tsx`, `StockStateBadge.tsx`), `src/components/SelectField.tsx`, `src/types/catalog.ts`, `src/lib/api/products.ts`, `src/mocks/handlers/products.ts`.
- **Endpoints** : `GET /products?shop_id=` (ajoute `stock` de la boutique), `GET|PUT /products/{id}`, `POST /products` (accepte `initial_quantity` et `shop_id`), `GET /products/{id}/stock`, `GET /shops/{id}/products/search?q=&services=` (résultat compact pour les sélecteurs ; un code-barres exact sort seul).
- **Règles** : code unique généré si vide (`P-0001`) ; code-barres unique ; un service n'a jamais de stock et ne redevient pas un service s'il a du stock ; la création crée une ligne de stock à 0 dans chaque boutique ; la quantité initiale crée un mouvement « Stock initial » (permission `stock.entry` requise) ; désactiver demande `products.disable` ; mode avancé (`tenant.advanced_mode` de `/me`) : type, marque, taxe.
- **Limites** : pas de variantes (`variable`) ; pas d'envoi de photo (vignette = initiale sur la couleur de la catégorie) ; pas de scan par caméra.

## M07 — Mon stock

| Adresse | Écran | Permission |
|---|---|---|
| `/stock` | Tuiles valeur / stock faible / rupture (servent de filtres), liste ; bascule « Toutes mes boutiques » (propriétaire) | `stock.view` |
| `/stock/entree` | Ajouter du stock (motifs : marchandise reçue, retour client…) | `stock.entry` |
| `/stock/sortie` | Retirer du stock (perte, casse, périmé, consommé) | `stock.exit` |
| `/stock/inventaire` | Quantité comptée, écart affiché avant validation | `stock.adjust` |
| `/stock/mouvements?product_id=` | Historique (entrées vertes, sorties rouges, stock restant après chaque mouvement) | `stock.view` |
| `/stock/operations/:id` | Détail d'un `MS-N`, annulation avec motif | `stock.view` (annuler : `stock.adjust`) |

- **Fichiers** : `src/features/stock/`, `src/components/QuantityInput.tsx`, `src/types/stock.ts`, `src/lib/api/stock.ts`, `src/mocks/handlers/stock.ts`, **`src/mocks/stock.ts`**.
- **Endpoints** : `GET /shops/{id}/stock` (avec `summary` : produits, faibles, ruptures, valeur), `GET /shops/{id}/stock/alerts`, `GET /stock` (vue toutes boutiques), `GET /shops/{id}/stock/movements?product_id=`, `POST /shops/{id}/adjustments` (`kind` = `entry` / `exit` / `inventory`), `GET /shops/{id}/adjustments/{id}`, `POST /shops/{id}/adjustments/{id}/cancel`.

## Le moteur de stock (`src/mocks/stock.ts`)

Toute variation de stock, quelle que soit son origine (stock initial, mouvement manuel, vente, annulation), passe par `applyStockChanges(changes, meta)` :

1. il vérifie **toutes** les lignes avant d'écrire quoi que ce soit (équivalent d'une transaction) ;
2. si une ligne passerait sous zéro, il lève un 422 « Stock insuffisant : il reste 3 btl de Huile Dinor 1 L. » ;
3. sinon, il met à jour `shopStock` et crée un mouvement signé par ligne.

Autres outils : `requireShopAccess(user, shopId)` (403 si l'utilisateur n'est pas affecté, ou boutique fermée), `canSeeAll(user)` (`records.view_all`), `stockState(quantity, alert)` (`ok` / `low` / `out`), `qty()` et `money()` (format de l'API).

## Règles appliquées (§7.2)

- Stock tenu par (produit, boutique), en unité de base ; **quantité = somme des mouvements** ; **jamais négatif**.
- Références `MS-N` par espace, consommées seulement si l'opération réussit.
- Annulation : motif obligatoire, mouvements inverses, refusée si elle rendrait le stock négatif, 409 si déjà annulée.
- `offline_uuid` : un second envoi renvoie l'opération déjà enregistrée.
- Sans `records.view_all`, on ne voit que ses propres mouvements.
- La vue « Toutes mes boutiques » n'a pas de boutons de mouvement (ils portent sur une boutique).

## Vérifications faites

Navigateur et appels directs au serveur simulé : sortie supérieure au stock bloquée à l'écran **et** refusée par le serveur ; annulation d'une entrée déjà consommée refusée ; motif obligatoire ; écart d'inventaire juste ; références `MS-1` à `MS-4` sans trou ; **aucune ligne de stock différente de la somme de ses mouvements** (contrôle sur toute la base) ; double envoi avec le même `offline_uuid` → une seule opération ; 403 pour un rôle sans droit.
