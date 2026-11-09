# Produit créé sur place

| | |
|---|---|
| **Statut** | Livrée le 9 novembre 2026 |
| **Branche** | `produit-sur-place` |
| **Cahier** | M06 (v3.4) |

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier)` | Cahier v3.4, dans ses deux copies |
| `feat(front)` | Formulaire court dans la recherche de produits, branché sur l'approvisionnement et l'entrée en stock |

## Ce qui a été livré

- **« Créer « … » » dans la recherche de produits** de l'approvisionnement (`/approvisionnements/nouveau`) et de l'ajout de stock (`/stock/entree`), avec la permission `products.create`.
  - Le bouton est sous la liste des résultats ; il reprend le texte cherché.
  - Il ouvre, dans le même panneau, un formulaire court : nom et prix de vente obligatoires ; catégorie, unité et code-barres facultatifs.
  - Un texte fait seulement de chiffres (8 ou plus, par exemple un scan inconnu) remplit le code-barres au lieu du nom.
  - Le produit créé devient aussitôt une ligne de l'opération en cours, sans perdre les lignes déjà saisies.
- **Pas de quantité de départ** : c'est l'approvisionnement ou l'entrée en stock qui fait entrer la marchandise. Sinon, elle serait comptée deux fois.
- **Prix d'achat** : il n'est pas demandé ; il se saisit sur la ligne de l'approvisionnement, et « Mettre à jour le prix d'achat des produits » l'enregistre sur la fiche.
- **Pas de création ailleurs** : ni à la sortie de stock, ni au comptage, ni au transfert, ni à la caisse, car on n'y manipule que des produits déjà en stock.

## Fichiers et endpoints

- `src/features/products/components/QuickProductForm.tsx` : le formulaire, et la conversion du produit créé en résultat de recherche.
- `src/features/products/components/ProductPicker.tsx` : propriété `allowCreate`.
- `src/features/purchases/pages/PurchaseFormPage.tsx` et `src/features/stock/pages/AdjustmentFormPage.tsx` (`allowCreate={kind === 'entry'}`).
- Textes `products.quick.*`.
- Endpoint : `POST /products`, sans changement côté API. La limite de produits de l'abonnement reste vérifiée par le serveur, et son message s'affiche dans le formulaire.

## Décisions

- **Produit simple seulement** : un produit à variantes se crée sur sa fiche.
- **Seules les unités de base sont proposées** : une unité d'achat (Carton) se règle sur la fiche.
- **Le formulaire s'affiche dans le panneau de recherche**, et non dans un second panneau.

## Vérifications

- Frontend : `typecheck`, `lint` et `build` passent.
- API : un test jetable a envoyé exactement ce que le formulaire envoie ; le produit est créé (201), avec l'unité par défaut et sans stock.
- Les écrans n'ont pas été essayés dans un navigateur.

## Limites

- La photo, le prix d'achat, le seuil d'alerte et le suivi des dates se complètent ensuite sur la fiche.
