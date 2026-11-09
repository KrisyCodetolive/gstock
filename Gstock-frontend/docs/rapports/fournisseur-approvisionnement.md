# Fournisseur d'un approvisionnement

| | |
|---|---|
| **Statut** | Livrée le 9 novembre 2026 |
| **Branche** | `fournisseur-approvisionnement` |
| **Cahier** | M11 (v3.3), exception limitée à l'ADR-012 |

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier)` | Cahier v3.3, dans ses deux copies : raccourci, attribution après coup, exception à l'ADR-012, endpoint |
| `feat(api)` | `PUT /shops/{id}/purchases/{id}/supplier`, journal, test |
| `feat(front)` | Raccourci « Nouveau fournisseur » et « Choisir le fournisseur » sur le détail |

## Ce qui a été livré

- **Raccourci « Nouveau fournisseur »** dans le formulaire d'approvisionnement (`/approvisionnements/nouveau`, permission `suppliers.manage`).
  - Un panneau demande le nom et, en option, le téléphone.
  - Le fournisseur créé est aussitôt choisi, sans perdre les lignes déjà saisies.
  - Il reste proposé dans la liste pendant que celle-ci se recharge.
  - L'adresse et la note se complètent ensuite sur sa fiche.
- **« Choisir le fournisseur »** sur le détail d'un approvisionnement enregistré sans fournisseur (`/approvisionnements/:id`, permission `purchases.create`).
  - Le bouton n'apparaît que si l'approvisionnement n'a pas de fournisseur et n'est pas annulé.
  - Il ouvre sur place la liste des fournisseurs, avec le même raccourci « Nouveau fournisseur ».
  - Une fois le fournisseur enregistré, la section affiche son nom, comme pour un fournisseur choisi à la création.
  - Le reste dû de l'approvisionnement passe alors dans le « dû » de ce fournisseur.

## Fichiers et endpoints

- Backend :
  - `app/Domain/Purchases/PurchaseService.php` (`assignSupplier()`) ;
  - `PurchaseController::assignSupplier` ;
  - la route est déclarée dans `routes/api.php`, au groupe `purchases.create` ;
  - test `test_a_supplier_can_be_assigned_later_but_never_replaced`.
- Frontend :
  - `src/features/purchases/components/SupplierSelect.tsx` : liste et panneau de création rapide, partagés par le formulaire et le détail ;
  - `pages/PurchaseFormPage.tsx` et `pages/PurchaseDetailPage.tsx` (`AssignSupplier`) ;
  - `hooks.ts` (`useAssignPurchaseSupplier`) et `src/lib/api/purchases.ts` (`assignPurchaseSupplier`) ;
  - textes `purchases.supplier_quick.*` et `purchases.detail.assign*` ;
  - libellé du journal `purchase.supplier_assigned`.
- Endpoint ajouté : `PUT /shops/{id}/purchases/{id}/supplier` avec `{supplier_id}`, qui renvoie l'approvisionnement.
  - 409 si l'approvisionnement est annulé, ou s'il a déjà un fournisseur (« Cet approvisionnement a déjà un fournisseur. »).
  - 422 si le fournisseur n'est pas choisi, ou s'il est inconnu ou inactif.
  - 404 pour l'approvisionnement d'un autre utilisateur, si l'on n'a pas `records.view_all`.
  - Le raccourci, lui, réutilise `POST /suppliers`.

## Règles appliquées

- **ADR-012 :**
  - un fournisseur ne s'attribue qu'à un approvisionnement qui n'en a pas, et ne se remplace jamais ;
  - les montants, le stock et les paiements ne bougent pas ;
  - l'attribution est journalisée (`audit_logs`, action `purchase.supplier_assigned`, avec le nom du fournisseur).
- **§6.2 :** sans `records.view_all`, on ne complète que ses propres approvisionnements.
- **Verrou :** l'approvisionnement est verrouillé pendant l'attribution, pour que deux attributions simultanées ne se remplacent pas.

## Décisions

- **Pas de remplacement d'un fournisseur déjà choisi**, même avec un motif : c'est la décision du propriétaire. En cas d'erreur, il faut annuler l'approvisionnement, puis le ressaisir.
- **L'attribution demande `purchases.create`**, et non une permission dédiée.
- **Les mouvements de stock déjà enregistrés ne sont pas réécrits** : ils restent sans nom de fournisseur, car ils font partie de l'historique.
- **Le choix sur le détail se fait sur place**, dans la section « Fournisseur », plutôt que dans un panneau. Le panneau de création rapide s'ouvre ainsi sans être imbriqué dans un autre.

## Vérifications

- Backend :
  - les 109 tests passent, dont le nouveau : cas normal, champ vide, fournisseur inconnu, remplacement refusé, approvisionnement annulé, visibilité, permission, autre espace ;
  - `pint` est propre.
- Frontend : `typecheck`, `lint` et `build` passent.

## Limites

- La liste des fournisseurs propose les 100 premiers fournisseurs actifs, comme avant. Il n'y a pas de recherche dans la liste.
- Une attribution par erreur ne se défait pas : il faut annuler l'approvisionnement et le ressaisir.
