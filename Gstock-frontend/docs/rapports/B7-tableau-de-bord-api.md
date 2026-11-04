# B7 — Tableau de bord et journal d'activité (backend)

> **Statut : terminée** (branche `api-tableau-de-bord`).
> Étape 4 du planning (§15) : M13 « Tableau de bord » et M14 « Journal d'activité ». Contexte Reporting.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `c48883f` | Tableau de bord d'une boutique et de toutes les boutiques, recherche du journal par auteur, échéanciers de crédits clients et vente annulée dans la démonstration, 4 tests. |

Le journal d'activité lui-même (`GET /audit-logs` et l'écriture des actions sensibles) existait depuis B1 ; chaque phase y a ajouté ses actions.

## Endpoints

Sous `/api/v1`, sur le sous-domaine de l'espace. Les formes JSON sont identiques à `Gstock-frontend/src/types/dashboard.ts`, et les règles reprennent celles de `src/mocks/handlers/dashboard.ts`.

| Endpoint | Permission |
|---|---|
| `GET /shops/{id}/dashboard?period=today\|week\|month` | `dashboard.view` |
| `GET /dashboard?period=…` (« Toutes mes boutiques » : boutiques actives) | `dashboard.view` et propriétaire (403 sinon) |
| `GET /audit-logs` (`search` dans l'objet, le motif **et le nom de l'auteur** ; `filter[domain\|user_id\|shop_id\|from]`) | `audit.view` |

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `app/Domain/Reporting/DashboardService.php` | Calcul de tous les chiffres en SQL agrégé : ventes, argent reçu par mode, sorties d'argent, coût des produits vendus, stock, crédits, échéances, activité récente. |
| `app/Http/Controllers/Api/V1/DashboardController.php` | Vue d'une boutique ; vue de toutes les boutiques réservée au propriétaire. |
| `app/Http/Controllers/Api/V1/AuditLogController.php` | Ajout de la recherche par nom de l'auteur, sans accents. |
| `app/Http/Controllers/Api/V1/StockController.php` | `STATE` (rupture, alerte, normal) devient public : le tableau de bord compte les alertes avec la même règle que « Mon stock ». |
| `database/seeders/DemoSalesSeeder.php` | Quatre échéanciers de crédits clients (deux avec une échéance dépassée) et une vente annulée par le gérant, comme dans les données simulées. |
| `tests/Feature/DashboardTest.php` | 4 tests. |

## Règles du cahier appliquées

- **§7.8, distinction financière :**
  - **Ventes totales** : ventes validées, payées ou à crédit ; les annulées ne comptent pas.
  - **Ventes payées immédiatement** : paiements réels de ces ventes. L'avoir n'est pas compté, car ce n'est pas un encaissement.
  - **Ventes à crédit** : la part mise à crédit.
  - **Remboursements reçus** : de l'argent reçu, mais pas une vente.
  - **Argent reçu** : payé immédiatement + remboursements, détaillé par mode de paiement.
  - **Sorties d'argent** : dépenses, argent rendu aux clients (P3), paiements aux fournisseurs.
  - **Reste à récupérer** : somme des restes des crédits ouverts, et nombre de clients concernés.
  - **Résultat estimé** = ventes − coût d'achat des produits vendus (coût noté sur chaque ligne au moment de la vente × quantité en unité de base) − dépenses. Il est signalé incomplet (`complete: false`) si un produit vendu n'avait pas de prix d'achat.
- **Comparaison** : la même durée juste avant (hier pour « aujourd'hui »). Le pourcentage vaut `null` s'il n'y a rien à comparer.
- **§7.10** : les périodes commencent à minuit au fuseau `Africa/Abidjan`. « 7 jours » et « 30 jours » incluent aujourd'hui.
- **Stock** : articles en alerte ou en rupture des produits actifs et des variantes actives, avec la même règle que « Mon stock ».
- **§7.7** : échéances des crédits clients en retard, et à venir dans les 7 jours, avec le montant qui reste à payer sur chacune.
- **Activité récente** : les 10 dernières opérations de toutes natures (vente, vente à crédit, paiement reçu, ancienne dette, approvisionnement, dépense, mouvement de stock), annulées comprises et marquées comme telles.
- **§6.2 et §3.6** :
  - sans `records.view_all`, seules ses propres opérations sont comptées ;
  - le stock et les crédits restent l'état réel de la boutique ;
  - la vue « Toutes mes boutiques » est réservée au propriétaire ;
  - le journal ne montre que les boutiques accessibles, et les actions sans boutique au propriétaire seulement (depuis B1).

## Décisions prises pendant la phase

- **Pas de table de statistiques** : tout est calculé à la demande par des requêtes agrégées, assez rapides pour une boutique. Une table de cumuls journaliers pourra venir si les volumes l'exigent.
- **Fuseau fixé à `Africa/Abidjan`** dans le service : le cahier n'en prévoit pas d'autre en V1, et l'espace n'a pas encore de réglage de fuseau.
- **Ordre de l'activité récente** : les dates sont gardées à la seconde près, donc deux opérations de la même seconde peuvent sortir dans n'importe quel ordre.

## Vérifications faites

- **77 tests passent** (701 assertions), dont 4 nouveaux :
  - un scénario complet : vente payée, vente en partie à crédit, remboursement, vente annulée, dépense, approvisionnement payé. On y vérifie chaque chiffre du §7.8, le détail par mode, le résultat (8 000 − 5 600 − 500 = 1 900) et l'ordre de l'activité ;
  - la comparaison avec hier (+125 %), le résultat incomplet sans prix d'achat, les ruptures et la période de 7 jours ;
  - les échéances en retard et à venir, la visibilité d'une vendeuse, le refus de la vue « toutes boutiques » à qui n'est pas propriétaire, et la somme sur deux boutiques ;
  - la recherche du journal par auteur.
- **Navigateur** (frontend en `dev:api`) :
  - l'accueil de la propriétaire sur la boutique et sur la vue « Toutes mes boutiques », sur 30 jours ;
  - les cartes (ventes, argent reçu par mode, stock faible, crédits, dépenses, résultat), les échéances et l'activité récente ;
  - le journal avec la recherche « Ibrahim » ;
  - l'accueil de la vendeuse sur mobile.

  Erreurs relevées : le 401 attendu sur `/me` avant la connexion, et un 404 sur `/onboarding` (assistant de démarrage, phase inscription).
- `vendor/bin/pint` passe.

## Limites

- **`GET /onboarding`** (assistant de démarrage) n'existe pas encore : l'accueil reçoit un 404 et n'affiche simplement pas l'assistant. Il arrive avec l'inscription et l'abonnement.
- **Résultat estimé de la démonstration** : il est négatif sur 30 jours (−112 425 FCFA). Le calcul est juste : dans le catalogue de démonstration, le prix d'achat vaut en moyenne 75 % du prix de vente, et les dépenses du mois (dont 135 000 FCFA de loyers) dépassent la marge. Les données simulées ont les mêmes chiffres.
- **Rapports et exports** (phase 2 du cahier) : non traités.
