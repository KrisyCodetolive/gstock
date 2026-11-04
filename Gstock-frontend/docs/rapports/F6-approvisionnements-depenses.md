# F6 — Approvisionnements et dépenses

> **Statut : à faire.** Branche suggérée : `front-achats`.
> Livrable du cahier (§11.4) : « Entrées de stock et sorties d'argent ». Modules M11, M12.

## M11 — Approvisionnements et fournisseurs

- **Approvisionnement** `AP-N` : boutique, fournisseur facultatif, date, produits, quantités, prix d'achat, total. **Le stock augmente à l'enregistrement** ; le prix d'achat du produit peut être mis à jour.
- Montant payé au fournisseur, reste dû, paiements ultérieurs ; échéancier facultatif (mêmes règles qu'en F5, §7.7).
- Historique [LISTE] ; annulation avec motif (retrait du stock, refusée si le stock deviendrait négatif, §7.2).
- **Fournisseurs** [LISTE] : nom, téléphone, adresse, note ; total acheté, payé, dû.
- Endpoints : `CRUD /suppliers`, `GET|POST /shops/{id}/purchases`, `GET /shops/{id}/purchases/{id}`, `POST /shops/{id}/purchases/{id}/cancel`, `POST /shops/{id}/purchases/{id}/payments`.
- Permissions : `suppliers.view`, `suppliers.manage`, `purchases.view`, `purchases.create`, `purchases.cancel`, `purchase_payments.create`.
- Critère : un approvisionnement de 5 produits en moins d'une minute ; le stock augmente du bon nombre d'unités de base (unité d'achat convertie, §7.3, en mode avancé).

## M12 — Dépenses

- Dépense `DP-N` : catégorie (référentiel de F2), montant, mode de paiement, date, note ; liste [LISTE] filtrable par période et catégorie ; annulation avec motif.
- Faisable hors ligne (F9) : envoyer un `offline_uuid`.
- Endpoints : `GET|POST /shops/{id}/expenses`, `POST /shops/{id}/expenses/{id}/cancel`.
- Permissions : `expenses.view`, `expenses.create`, `expenses.cancel`.

## Ce qui existe déjà

- **Stock** : `applyStockChanges()` (`src/mocks/stock.ts`) avec les types de source `purchase` et `purchase_cancel` déjà prévus dans `MockMovement` et `MovementSource`. Ajouter le lien vers l'approvisionnement dans `MovementRow` (`src/features/stock/components/MovementsPreview.tsx`).
- **Sélection de produits** : `ProductPicker` et `QuantityInput` (le formulaire d'entrée de stock `AdjustmentFormPage.tsx` est un bon modèle de formulaire à lignes).
- **Référentiels** : catégories de dépenses et modes de paiement (F2).
- **Références** : ajouter `AP` et `DP` à `db.sequences`.
- **Navigation** : rubriques `purchases`, `suppliers`, `expenses` avec `phase: 'F6'` dans `navigation.ts`.
- **Annulation** : `CancelDialog`.

## Points d'attention

- Les dépenses alimentent le tableau de bord (F7, « Dépenses » et « Résultat estimé ») : prévoir dès maintenant les totaux par période côté serveur simulé.
- Mettre à jour le prix d'achat d'un produit change la valeur du stock (`/stock`) : invalider `stock` et `products`.
