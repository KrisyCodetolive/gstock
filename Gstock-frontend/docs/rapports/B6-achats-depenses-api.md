# B6 — Approvisionnements, fournisseurs et dépenses (backend)

> **Statut : terminée** (branche `api-achats-depenses`).
> Étape 4 du planning (§15) : M11 « Approvisionnements et fournisseurs » et M12 « Dépenses ».

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `1ed79fa` | Livre toute la phase : fournisseurs ; calcul et enregistrement des approvisionnements `AP-N` (unité d'achat convertie, entrée en stock, prix d'achat mis à jour) ; paiements fournisseur ; échéancier des dettes fournisseurs ; annulation motivée ; dépenses `DP-N`. S'y ajoutent les données de démonstration et 7 tests. |

## Endpoints

Sous `/api/v1`, sur le sous-domaine de l'espace. Les formes JSON sont identiques à `Gstock-frontend/src/types/purchases.ts`, et les règles reprennent celles de `src/mocks/purchases.ts`.

| Endpoint | Permission |
|---|---|
| `GET /suppliers` (`search`, `filter[is_active]`, `filter[has_due]`) | `suppliers.view` ou `purchases.create` |
| `GET /suppliers/{id}` | `suppliers.view` |
| `POST /suppliers`, `PUT /suppliers/{id}` (pas de suppression, désactivation) | `suppliers.manage` |
| `POST /shops/{id}/purchases/quote` (calcul sans enregistrer) | `purchases.create` |
| `POST /shops/{id}/purchases` (`paid_amount`, `payment_method_id`, `update_costs`) | `purchases.create` |
| `GET /shops/{id}/purchases` (`search`, `filter[supplier_id\|payment_status\|overdue\|from\|to]`, `summary`) | `purchases.view` |
| `GET /shops/{id}/purchases/{id}` | `purchases.view` |
| `POST /shops/{id}/purchases/{id}/payments` | `purchase_payments.create` |
| `PUT /shops/{id}/purchases/{id}/installments` | `purchase_payments.create` |
| `POST /shops/{id}/purchases/{id}/cancel` (`reason` obligatoire) | `purchases.cancel` |
| `GET /shops/{id}/expenses` (`search`, `filter[expense_category_id\|from\|to]`, `summary.by_category`) | `expenses.view` |
| `POST /shops/{id}/expenses` (`offline_uuid` idempotent) | `expenses.create` |
| `POST /shops/{id}/expenses/{id}/cancel` (`reason` obligatoire) | `expenses.cancel` |

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_11_05_000500_create_purchase_and_expense_tables.php` | `suppliers`, `purchases`, `purchase_items` (unité de la ligne et `base_quantity`), `purchase_payments`, `expenses` (§8.7). |
| `app/Domain/Purchases/PurchaseService.php` | Calcul de référence (§7.4). Enregistrement : référence `AP-N`, entrée en stock par `StockLedger`, prix d'achat ramené à l'unité de base. Gère aussi les paiements (ligne verrouillée), l'échéancier (`InstallmentSchedule` de B5, `payable_type = purchase`) et l'annulation. |
| `app/Domain/Expenses/ExpenseService.php` | Dépense `DP-N` idempotente, annulation motivée et journalisée. |
| `app/Http/Resources/PurchasesPresenter.php` | Formes JSON : fournisseur (totaux sur les boutiques visibles), approvisionnement, élément de liste (`overdue_amount`), paiement, dépense. |
| `app/Http/Controllers/Api/V1/SupplierController.php`, `PurchaseController.php`, `ExpenseController.php` | Endpoints. |
| `database/seeders/DemoPurchasesSeeder.php` | Données de démonstration (détail ci-dessous). |
| `tests/Feature/PurchasesTest.php`, `ExpensesTest.php` | 7 tests. |

Données de démonstration du seeder :
- les 5 fournisseurs de la démo ;
- 6 approvisionnements, payés, payés en partie ou à payer, dont un avec un échéancier dont la première échéance est dépassée ;
- 12 dépenses : loyer, électricité, transport, internet, personnel, autres.

## Règles du cahier appliquées

- **§7.4, montants** : le serveur recalcule tout (sous-total des lignes, remise plafonnée au total, total). L'écran affiche le devis de `purchases/quote`.
- **§7.3, unités** : l'unité d'une ligne est l'unité de base du produit ou l'une de ses unités dérivées actives. Le stock entre en unité de base : 2 cartons de 12 font 24 unités. Le prix d'achat mis à jour (`update_costs`) est ramené à l'unité de base : 3 000 FCFA le carton donnent 250 FCFA l'unité.
- **M11, entrée en stock** : le stock augmente dès l'enregistrement (mouvement `purchase`, coût unitaire noté). Une erreur de saisie ne consomme pas de numéro.
- **M11, paiements fournisseur** : un premier paiement est possible à l'enregistrement, puis d'autres plus tard, sans jamais dépasser le reste dû (« Il ne reste que X FCFA à payer. »). Le statut vaut `paid`, `partial` ou `unpaid`.
- **§7.7, échéancier** : le total des échéances doit égaler le reste dû. Les paiements soldent les échéances dans l'ordre ; une échéance dépassée et non soldée est « en retard ». On peut filtrer les approvisionnements avec `filter[overdue]`.
- **§7.2 et ADR-012, annulation d'un approvisionnement** : la marchandise sort du stock. L'annulation est refusée en entier si le stock deviendrait négatif, par exemple quand la marchandise a déjà été vendue. L'approvisionnement reste visible, marqué « annulé ». Une double annulation renvoie 409, un paiement sur un approvisionnement annulé aussi. L'action est journalisée (`purchase.cancelled`).
- **M12, dépenses** : catégorie, montant, mode de paiement, date (jamais dans le futur) et note. La liste se filtre par période et par catégorie, avec des totaux par catégorie qui excluent les dépenses annulées. L'annulation exige un motif et est journalisée (`expense.cancelled`).
- **ADR-005** : une dépense envoyée deux fois avec le même `offline_uuid` n'est enregistrée qu'une fois (statut 200).
- **§6.2** : l'affectation à la boutique est vérifiée. Sans `records.view_all`, on ne voit que ses propres approvisionnements et dépenses. Les totaux des fournisseurs ne portent que sur les boutiques visibles.

## Décisions prises pendant la phase

- **`paid_amount` et `payment_status` gardés dans `purchases`** (§8.7) et mis à jour à chaque paiement, sur la ligne verrouillée. Les listes et les totaux des fournisseurs se calculent ainsi en SQL.
- **Échéancier sous `purchase_payments.create`**, comme dans les données simulées : c'est le même droit que payer le fournisseur.
- **Le paiement déjà fait reste compté après une annulation** : il apparaît toujours dans le détail, mais le reste dû tombe à 0. Rendre l'argent d'un fournisseur n'est pas prévu par le cahier.
- **Totaux de la liste** : ils portent sur la liste filtrée, recherche comprise, hors annulés. Les données simulées ignoraient la recherche dans ces totaux.
- **Échéancier de démonstration** : la dette envers « Moussa Commerce » (qui « paie à 30 jours ») a deux échéances, dont une en retard, pour illustrer le filtre et la carte « en retard ». Les données simulées n'en avaient pas.

## Vérifications faites

- **73 tests passent** (653 assertions), dont 7 nouveaux. Ils couvrent :
  - la conversion carton → unités ;
  - le devis et la remise ;
  - la mise à jour du prix d'achat ;
  - les messages de validation, sans numéro consommé ;
  - les paiements plafonnés et l'échéancier (en retard, puis soldé dans l'ordre) ;
  - l'annulation refusée sous zéro, puis acceptée ;
  - les totaux de la liste, la visibilité et les fournisseurs (unicité du nom, désactivation, droits) ;
  - les dépenses : totaux par catégorie, annulation, validation, idempotence et visibilité.
- **Données de démonstration** : 6 approvisionnements, 12 dépenses, 5 fournisseurs. Aucun écart entre le stock et la somme des mouvements.
- **Navigateur** (frontend en `dev:api`) :
  - la liste des approvisionnements, avec ses totaux ;
  - un nouvel approvisionnement de 2 cartons de savon, où l'écran affiche « 24 u » et le total de 7 200 FCFA calculé par le serveur ;
  - l'enregistrement `AP-7` ;
  - un paiement au fournisseur dans le détail, qui passe à « Payé » ;
  - le mouvement `AP-7` dans « Mon stock » ;
  - la liste des fournisseurs avec ce qu'on leur doit ;
  - une dépense enregistrée.

  Seule erreur relevée : le 401 attendu sur `/me` avant la connexion.
- `vendor/bin/pint` passe.

## Limites

- Le **tableau de bord** (argent sorti, résultat estimé, §7.8) et le **journal d'activité** n'ont pas encore leur backend.
- **Synchronisation hors ligne** (`POST /shops/{id}/sync`) : le service des dépenses est déjà idempotent ; la synchronisation est prévue à l'étape 7.
- **Taxes et remises par ligne** d'approvisionnement : les colonnes existent (§8.7), mais ni le contrat d'API ni l'écran ne les utilisent encore.
