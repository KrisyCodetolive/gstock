# Création rapide des produits

| | |
|---|---|
| **Statut** | Livrée le 5 novembre 2026 |
| **Branche** | `produits-creation-rapide` |
| **Cahier** | M06 (création rapide, quantité initiale) |

## Ce qui a été livré

- **« Ajouter et créer un autre »** (`/produits/nouveau`) : enregistre le produit (et sa photo), puis vide le formulaire pour le suivant en gardant la catégorie, l'unité, le type et le suivi des dates ; un message confirme le produit ajouté. « Ajouter un produit » ouvre toujours la fiche. Sur mobile, le bouton est sur sa propre ligne sous les deux boutons principaux.
- **Stock de départ par variante** : à la création d'un produit à variantes (mode avancé), chaque nouvelle variante a « Quantité en stock » et, si le produit est suivi, sa date de péremption, facultatives. Côté serveur, une entrée « Stock initial » par variante dans la boutique courante.

## Fichiers et endpoints

- Backend : `app/Domain/Catalog/ProductService.php` (`variants[].initial_quantity`, `variants[].initial_expiry_date` à la création ; `saveVariants` renvoie les identifiants) ; test `test_each_variant_can_start_with_its_own_stock`.
- Frontend : `src/features/products/pages/ProductFormPage.tsx`, `components/VariantsEditor.tsx`, `schemas.ts` ; `src/types/catalog.ts` (`ProductVariantPayload`).
- Endpoint : `POST /products` accepte `initial_quantity` et `initial_expiry_date` par variante (mêmes droits que la quantité initiale : accès à la boutique et `stock.entry`).

## Vérifications

- Backend : 104 tests passent.
- Frontend : `typecheck`, `lint`, `build`.
- Navigateur (Chrome, mobile, contre l'API locale) : deux produits à la suite (formulaire vidé, catégorie gardée, le second ouvre sa fiche) ; produit à variantes créé avec 12 et 8 en stock à Cocody.

## Limites

- La quantité par variante ne se saisit qu'à la création ; ensuite, « Ajouter du stock » sur la fiche.
