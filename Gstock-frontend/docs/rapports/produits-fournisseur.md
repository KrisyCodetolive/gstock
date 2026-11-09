# Produits par fournisseur et rachat

| | |
|---|---|
| **Statut** | Livrée le 9 novembre 2026 |
| **Branche** | `produits-fournisseur` |
| **Cahier** | M11 et M15 (v3.9) |

Le lien entre un produit et un fournisseur **se déduit des approvisionnements reçus**. Il n'y a ni nouvelle table ni saisie en plus, et les approvisionnements annulés ne comptent pas.

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier)` | Cahier v3.9 : produits d'un fournisseur, fournisseurs d'un produit, racheter chez un fournisseur |
| `feat(api)` | `SupplierCatalog`, `GET /suppliers/{id}/products`, `GET /products/{id}/suppliers`, test |
| `feat(front)` | Sections sur les fiches fournisseur et produit |
| `feat(api)` | Recherche de produits filtrée par fournisseur, fournisseur habituel dans « À racheter bientôt », tests |
| `feat(front)` | « Racheter chez ce fournisseur », panneau « Ses produits à racheter », regroupement par fournisseur dans les rapports |

## Écrans

| Écran | Adresse | Permission |
|---|---|---|
| « Produits achetés chez ce fournisseur » | `/fournisseurs/:id` | `suppliers.view` + `purchases.view` |
| « Ses fournisseurs » | `/produits/:id` | `products.view` + `purchases.view` |
| Bouton « Racheter chez ce fournisseur » | `/fournisseurs/:id` | `purchases.create`, fournisseur actif |
| Panneau « Ses produits à racheter » | `/approvisionnements/nouveau?fournisseur=:id`, ou dès qu'un fournisseur est choisi | `purchases.create` |
| Fournisseur habituel, vue « Par fournisseur » et « Racheter chez lui » | `/rapports?onglet=produits` | `reports.view` (bouton : `purchases.create`) |

**Fiche fournisseur, pour chaque produit ou variante :**
- le dernier prix d'achat, dans l'unité achetée (par exemple « 3 000 FCFA / ctn », soit 250 FCFA l'unité) ;
- l'évolution depuis l'achat précédent (hausse en rouge, baisse en vert, avec une icône et un texte) ;
- la fourchette de prix, du plus bas au plus haut ;
- la quantité achetée, le nombre d'achats et la date du dernier achat ;
- le stock de la boutique courante, avec le badge « stock faible » ou « rupture » ;
- une recherche au-delà de 5 produits.

**Fiche produit :** les fournisseurs du produit, du moins cher au plus cher d'après le dernier achat.
- Le badge « Le moins cher » s'affiche pour un produit sans variantes.
- Les achats sans fournisseur forment une ligne à part.

**Racheter :**
- Le formulaire d'approvisionnement s'ouvre avec le fournisseur choisi.
- Le panneau liste ses produits en stock faible ou en rupture dans la boutique ; on peut aussi afficher tous ses produits.
- On ajoute un produit, ou tous d'un coup, avec la dernière unité et le dernier prix achetés chez ce fournisseur.

## Endpoints

- `GET /suppliers/{id}/products?shop_id=` : une ligne par article, du plus récent au plus ancien.
  - Champs : `last_cost` (par unité de base), `last_unit_cost` et `last_unit`, `previous_cost`, `min_cost`, `max_cost`, `purchases`, `quantity`, `spent`, `stock`.
  - Il exige `suppliers.view` et `purchases.view`, et `shop_id` est vérifié.
- `GET /products/{id}/suppliers` : une ligne par fournisseur (et variante), avec les mêmes prix ; `supplier` vaut `null` pour les achats sans fournisseur.
  - Il exige `products.view` et `purchases.view`.
- `GET /shops/{id}/products/search?supplier_id=&to_restock=true` : les articles achetés chez ce fournisseur, avec `supplier_last` (`unit_id`, `cost`). `to_restock` ne garde que le stock faible ou en rupture.
  - Il exige `purchases.create` ou `purchases.view`.
- `GET …/reports/products` : `restock.items[].supplier`, le fournisseur habituel, c'est-à-dire le dernier chez qui l'article a été acheté.

## Règles et décisions

- **Prix par unité de base** = prix de la ligne × quantité ÷ quantité en unité de base. La remise de ligne n'est pas comptée : c'est le prix d'achat saisi.
- **Périmètre** : les boutiques visibles (toutes pour le propriétaire, sinon les boutiques affectées), comme les totaux du fournisseur.
- **Prix d'achat protégés** : ils demandent `purchases.view` (ou `purchases.create` pour la recherche de rachat), en plus du droit de voir le fournisseur ou le produit.
- **Fournisseur habituel déduit**, et non saisi : c'est le dernier fournisseur. Un champ « fournisseur principal » sur le produit a été écarté, car il faudrait le tenir à jour.
- **Ligne préremplie au rachat** : la dernière unité et le dernier prix achetés chez ce fournisseur, à condition que l'unité soit encore valable pour le produit. Sinon, ce sont l'unité d'achat et le prix d'achat du produit.

## Vérifications

- Backend :
  - les 114 tests passent ;
  - le test du fournisseur couvre :
    - un achat au carton puis un achat à l'unité ;
    - un second fournisseur moins cher, et un achat sans fournisseur ;
    - un approvisionnement annulé exclu ;
    - le stock de la boutique ;
    - la recherche filtrée et `to_restock` ;
    - les permissions, et un utilisateur sans boutique.
  - `ReportsTest` vérifie le fournisseur habituel.
- Frontend : `typecheck`, `lint` et `build` passent.
- API Docker sur les données de démonstration :
  - le fournisseur 1 a 4 produits, dont « Riz local 1 kg » acheté 2 fois à 450 FCFA, stock 36 ;
  - les fournisseurs d'un produit et la recherche filtrée répondent correctement ;
  - les données de démonstration n'ont pas de produit de fournisseur à racheter.

## Limites

- Les écrans n'ont pas été essayés dans un navigateur.
- Les approvisionnements enregistrés sans fournisseur n'apparaissent chez aucun fournisseur. Le bouton « Choisir le fournisseur » de leur détail permet de les rattacher.
- La comparaison des prix suit le dernier achat de chaque fournisseur, pas une moyenne.
