# Péremption visible dans Mon stock

| | |
|---|---|
| **Statut** | Livrée le 9 novembre 2026 |
| **Branche** | `peremption-visible` |
| **Cahier** | M07, §7.11 (v3.6) |

**Pourquoi :** les tuiles de péremption n'apparaissaient que s'il y avait du périmé ou du bientôt périmé. Un espace sans produit suivi, comme `yves-shop`, ne voyait donc jamais la fonction, et ne savait pas qu'elle existait.

## Commits

| Commit | Contenu |
|---|---|
| `feat(api)` | `summary.tracked`, `filter[expiry]=tracked`, tests |
| `docs(cahier)` | Cahier v3.6, dans ses deux copies |
| `feat(front)` | Tuiles toujours visibles, filtre « Produits suivis », prochaine date sur chaque ligne |

## Ce qui a été livré (`/stock`, permission `stock.view`)

- **Sans produit suivi** : une tuile « Péremption » indique « Aucun produit suivi ». Elle explique où activer le suivi, et mène à la liste des produits.
- **Avec au moins un produit suivi** :
  - les trois tuiles « Périmés », « Bientôt périmés » et « Produits suivis » sont toujours affichées, même à 0 ;
  - « Produits suivis » liste tous les articles suivis, avec la date la plus proche en premier, puis ceux sans date.
- **Sur chaque ligne d'un produit suivi** : la quantité périmée, ou à écouler, comme avant. Sinon, « Prochaine date : … », ou « Date de péremption non indiquée ».
- **La carte de l'accueil est inchangée** : elle reste une alerte, affichée seulement s'il y a quelque chose à signaler.

## Endpoints

- `GET /shops/{id}/stock` : ajout de `summary.tracked`, le nombre d'articles dont le produit suit ses dates.
- Ajout de `filter[expiry]=tracked` : seulement les articles suivis, triés par date la plus proche (sans date en dernier), puis par nom.

## Vérifications

- Backend : les 109 tests passent.
  - `ExpiryTest` vérifie maintenant `summary.tracked`, l'ordre du filtre et la prochaine date d'un produit à date lointaine.
  - L'assertion du résumé de `StockTest` a été mise à jour, avec le nouveau champ.
- `pint` est propre.
- Frontend : `typecheck`, `lint` et `build` passent.
- Les écrans n'ont pas été essayés dans un navigateur.

## Limites

- La vue « Toutes mes boutiques » n'affiche pas la péremption : elle reste par boutique.
