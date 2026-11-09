# Référentiels créés sur place

| | |
|---|---|
| **Statut** | Livrée le 9 novembre 2026 |
| **Branche** | `referentiels-sur-place` |
| **Cahier** | M05 (v3.5) |

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier)` | Cahier v3.5, dans ses deux copies |
| `feat(front)` | Composant commun, branché sur la fiche produit et la dépense |
| `feat(front)` | Le même raccourci dans le formulaire court du produit créé sur place |

## Ce qui a été livré

Sous une liste déroulante, un lien « Nouvelle … » ouvre sur place un champ « nom » et un bouton « Ajouter ». L'élément est créé puis choisi aussitôt, sans passer par « Paramètres », puis « Référentiels ».

| Écran | Liste | Permission |
|---|---|---|
| Fiche produit (`/produits/nouveau`, `/produits/:id`) | Catégorie | `categories.manage` |
| Fiche produit, mode avancé | Marque | `settings.manage` |
| Produit créé sur place (approvisionnement, entrée en stock) | Catégorie | `categories.manage` |
| Nouvelle dépense (panneau de `/depenses`) | Catégorie | `settings.manage` |

- Une catégorie de produits reçoit une couleur à tour de rôle (pêche, jaune, menthe, lavande), modifiable ensuite dans les paramètres.
- Sans la permission, le lien n'apparaît pas : ce sont les mêmes droits que l'écran du référentiel.

## Fichiers et endpoints

- `src/features/referentials/components/QuickReferentialCreate.tsx` : le composant commun.
- Il est branché dans `src/features/products/pages/ProductFormPage.tsx`, `src/features/products/components/QuickProductForm.tsx` et `src/features/purchases/pages/ExpensesPage.tsx`.
- Textes `referentials.quick.*`.
- Endpoints existants : `POST /categories`, `POST /brands` et `POST /expense-categories`. L'API n'a pas changé.

## Décisions

- **Création en ligne, sans panneau** : le formulaire de dépense est déjà un panneau, et la fiche produit un formulaire. Le composant n'est donc pas un `<form>` (on ne peut pas les imbriquer) : la touche Entrée valide le nom sans envoyer le formulaire qui l'entoure.
- **L'élément créé apparaît tout de suite dans la liste** : il est ajouté au cache des listes avant leur rechargement.
- **Les unités ne sont pas concernées** : elles demandent une unité de base et un facteur de conversion, et changent rarement. Les modes de paiement non plus, car ils engagent les encaissements.

## Vérifications

- Frontend : `typecheck`, `lint` et `build` passent.
- Les écrans n'ont pas été essayés dans un navigateur.

## Limites

- Dans le panneau de dépense, la touche Échap ferme tout le panneau, pas seulement le champ de création.
