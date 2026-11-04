# B2 — Référentiels (backend)

> **Statut : terminée** (branche `api-referentiels`).
> Étape 4 du planning (§15), premier module métier : M05 « Référentiels ».

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `bcbf3d1` | Tables, modèles et endpoints des cinq référentiels ; référentiels par défaut d'un nouvel espace ; catégories et marques de l'espace de démonstration ; test unitaire de conversion des unités ; 6 tests du module. |

## Endpoints

Sous `/api/v1`, sur le sous-domaine de l'espace. Liste (`page`, `per_page`, `search`, `sort=name`, `filter[is_active]`), création, modification. **Pas de suppression** : on désactive (`is_active: false`).

| Référentiel | Endpoints | Lecture | Écriture |
|---|---|---|---|
| Catégories de produits | `GET|POST /categories`, `PUT /categories/{id}` | `products.view` ou `categories.manage` | `categories.manage` |
| Unités | `GET|POST /units`, `PUT /units/{id}` | `products.view` ou `units.manage` | `units.manage` |
| Modes de paiement | `GET|POST /payment-methods`, `PUT /payment-methods/{id}` | `sales.create`, `repayments.create`, `expenses.create` ou `settings.manage` | `settings.manage` |
| Catégories de dépenses | `GET|POST /expense-categories`, `PUT /expense-categories/{id}` | `expenses.view` ou `settings.manage` | `settings.manage` |
| Marques (mode avancé) | `GET|POST /brands`, `PUT /brands/{id}` | `products.view` ou `settings.manage` | `settings.manage` |

Formes JSON identiques à `Gstock-frontend/src/types/referentials.ts`.

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_11_05_000100_create_referential_tables.php` | `categories`, `brands`, `units`, `payment_methods`, `expense_categories`, avec `tenant_id` et un nom unique par espace. |
| `app/Domain/Catalog/Models/` | `Category`, `Brand`, `Unit` (`factor()` : nombre d'unités de base, calculé avec bcmath). |
| `app/Domain/Sales/Models/PaymentMethod.php`, `app/Domain/Expenses/Models/ExpenseCategory.php` | Modes de paiement et catégories de dépenses. |
| `app/Http/Controllers/Api/V1/Referentials/` | `ReferentialController` (base commune : liste, création, modification, nom unique sans accents ni majuscules) et une classe par référentiel. |
| `app/Domain/Platform/Actions/CreateDefaultReferentials.php` | Référentiels créés à l'inscription, appelé par `ProvisionTenant`. |

## Règles du cahier appliquées

- **M05** : un élément utilisé se désactive, il ne se supprime pas (pas de route `DELETE`, réponse 405).
- **§7.3** : une unité dérivée se rattache à une unité de base, jamais à une autre unité dérivée, avec un opérateur `*` ou `/` et une valeur supérieure à 0 ; une unité dont d'autres dépendent reste une unité de base.
- **ADR-003** : GeniusPay ne s'applique qu'aux modes de type Mobile Money et carte (`uses_geniuspay` forcé à faux sinon).
- **M00** : un nouvel espace reçoit les unités courantes (Unité, Paquet, Bouteille, Sachet, Kilogramme, Litre, Carton = Unité × 12, Gramme = Kilogramme ÷ 1000), trois modes de paiement (Espèces, Mobile Money, Carte bancaire) et six catégories de dépenses (Transport, Électricité, Loyer, Internet, Personnel, Autres dépenses), comme dans les données simulées.
- **ADR-002** : un même nom est permis dans deux espaces ; les référentiels d'un autre espace sont invisibles (404).

## Décisions prises pendant la phase

- **Une base commune pour les cinq référentiels** (CRUD simple, ADR-001), avec les mêmes messages d'erreur que les handlers simulés.
- **`operator_value`** est stocké en `NUMERIC(15,3)` et renvoyé sans zéros inutiles (`"12"`, `"1000"`), comme dans les données simulées.
- **`products_count`** (catégories, unités) vaut 0 tant que le module Produits n'existe pas : il sera calculé en B3.
- **Espace de démonstration** : les 8 catégories et les 2 marques des données simulées ; la carte bancaire y est désactivée, comme dans les données simulées.

## Vérifications faites

- **33 tests passent** (247 assertions), dont 6 nouveaux tests de module et 3 tests unitaires : référentiels par défaut d'un nouvel espace, création, renommage, désactivation et absence de suppression, nom en double refusé (même en minuscules), règles des unités dérivées, GeniusPay limité au Mobile Money et à la carte, permissions de lecture et d'écriture, isolation des espaces, conversion des unités.
- **Navigateur** (frontend en `dev:api`) : les écrans Paramètres › Catégories, Unités, Modes de paiement, Catégories de dépenses et Marques lisent PostgreSQL ; nom en double refusé par le serveur ; création d'une catégorie.
- `vendor/bin/pint --test` passe.

## Limites

- `products_count` n'est pas encore calculé (module Produits, B3).
- Un changement d'opérateur ou de valeur sur une unité déjà utilisée par des produits n'est pas encore bloqué : la règle sera ajoutée avec les produits et le stock (B3), quand l'impact sur les quantités existera.
- Le mode de paiement par défaut de l'espace (`tenant_settings.default_payment_method_id`) n'est pas encore exposé.
