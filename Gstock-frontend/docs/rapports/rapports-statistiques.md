# Rapports, première partie

| | |
|---|---|
| **Statut** | Livrée le 9 novembre 2026 |
| **Branche** | `rapports` |
| **Cahier** | M15 (nouveau), P15, §6.3 (v3.7) ; première partie des « Rapports et statistiques » de la phase 2, avancée en phase 1 |

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier)` | M15, P15, permission `reports.view`, v3.7 |
| `feat(api)` | Migration de la permission, `ReportService`, `ReportController`, quatre routes, tests |
| `feat(front)` | Rubrique « Rapports », onglets Ventes et Produits, graphique |

## Écran

| Écran | Adresse | Permission |
|---|---|---|
| Rapports, onglets Ventes et Produits | `/rapports`, `/rapports?onglet=produits` | `reports.view` (propriétaire par défaut) |

Les filtres sont sur une seule rangée :
- la période : 7 jours, 30 jours, ce mois-ci, mois dernier, ou autres dates (du … au …) ; par défaut, 30 jours ;
- la boutique, ou « Toutes mes boutiques » pour le propriétaire qui en a plusieurs.

**Onglet Ventes :**
- quatre tuiles :
  - ventes, avec l'évolution par rapport à la période d'avant ;
  - nombre de ventes, et articles par vente ;
  - ticket moyen ;
  - marge, avec le prix d'achat des produits vendus, et un avertissement si elle est incomplète ;
- graphique « Ventes jour par jour » :
  - une barre par jour, ou par semaine au-delà de 62 jours ;
  - une info-bulle au survol, au toucher et aux flèches du clavier ;
- meilleur jour et jour le plus faible ;
- détail jour par jour sous forme de tableau.

**Onglet Produits :**
- **meilleurs produits**, les 10 premiers, classés au choix par chiffre d'affaires, quantité ou marge ;
- **produits qui font perdre de l'argent** : ceux vendus à perte sur la période, et ceux dont le prix de vente actuel est sous le prix d'achat ;
- **à racheter bientôt** : jours de stock restants (badge rouge à 0, orange jusqu'à 7 jours), stock, vente par jour et quantité conseillée ;
- **produits qui dorment** : sans vente depuis 30, 60 ou 90 jours, avec le total de l'argent immobilisé et la dernière vente.

Chaque ligne mène à la fiche du produit.

## Fichiers et endpoints

- Backend :
  - migration `2026_11_10_000100_add_reports_permission.php` ;
  - `app/Domain/Reporting/ReportService.php` ;
  - `app/Http/Controllers/Api/V1/ReportController.php` ;
  - `tests/Feature/ReportsTest.php` (3 tests).
- Frontend :
  - `src/features/reports/` : `pages/ReportsPage.tsx`, `components/SalesChart.tsx`, `hooks.ts`, `period.ts` ;
  - `src/lib/api/reports.ts`, `src/types/reports.ts`, `src/locales/fr/reports.json` ;
  - entrée « Rapports » dans `src/app/navigation.ts`.
- Endpoints ajoutés (`from`, `to` en Y-m-d) :
  - `GET /shops/{id}/reports/sales?from=&to=`, et `GET /reports/sales` pour toutes les boutiques (propriétaire) ;
  - `GET /shops/{id}/reports/products?from=&to=&dormant_days=30|60|90`, et `GET /reports/products` pour toutes les boutiques (propriétaire).

## Règles appliquées

- **Ventes prises en compte** : seules les ventes validées comptent ; les ventes annulées sont exclues (ADR-012).
- **Période** :
  - au fuseau de l'espace (§7.10) ;
  - 366 jours au plus, jamais dans le futur ;
  - refus en 422 avec un message en français.
- **Chiffre d'un produit** : le sous-total de ses lignes, réparti au prorata du total de la vente. La somme des produits égale ainsi le total des ventes, remise globale et taxe comprises.
- **Marge** = ventes − prix d'achat des produits vendus (§7.8).
  - Pour la période entière, elle est signalée incomplète si une ligne n'a pas de prix d'achat.
  - Pour un produit, elle est `null` dans ce cas.
- **Vitesse de vente** : quantité vendue sur les 30 derniers jours ÷ 30, quelle que soit la période choisie.
  - « À racheter » : stock de 14 jours ou moins.
  - Quantité conseillée : de quoi tenir 30 jours.
- **Produits dormants** : ils doivent être en stock, et sans vente depuis N jours.
  - Un produit créé il y a moins de N jours n'est pas dormant.
  - La valeur immobilisée est le stock × le prix d'achat.
- **Permission `reports.view`** : créée par migration, elle revient au propriétaire, qui reçoit toutes les permissions (ADR-014). Il peut l'ajouter à un autre rôle.

## Décisions

- **Une rubrique dédiée** : l'accueil reste un coup d'œil, et les rapports servent à analyser.
- **Toutes les opérations de la boutique** : les rapports couvrent toutes les ventes, quel que soit l'auteur. `reports.view` est un droit de supervision, sans le filtre « ses propres opérations » de `records.view_all`.
- **Graphique en SVG, sans bibliothèque** : une seule série, des barres d'au plus 24 px aux extrémités arrondies, une grille discrète, la couleur indigo et la mangue au survol. Le détail chiffré reste lisible sans survol, dans le tableau.

## Vérifications

- Backend :
  - les 112 tests passent ;
  - `ReportsTest` couvre totaux, ticket moyen, marge incomplète, jours sans vente, ventes annulées exclues, périodes invalides, prorata d'une remise globale, vente à perte, prix sous le prix d'achat, à racheter, dormants, choix des jours, permission, vue de toutes les boutiques et autre espace ;
  - les tests qui comptent les permissions passent de 43 à 44.
- Frontend : `typecheck`, `lint` et `build` passent.
- API Docker sur les données de démonstration (boutique Cocody, 30 jours), connecté comme propriétaire :
  - 111 ventes pour 230 200 FCFA, ticket moyen de 2 073,87 FCFA, marge de 54 875 FCFA, +53,3 % sur la période d'avant ;
  - la somme des 40 produits vendus et celle des 30 jours égalent toutes deux le total ;
  - un produit à racheter (« Eau minérale pack de 6 » : 11 jours de stock, 12 conseillés) ;
  - aucun produit dormant, car les données de démonstration sont récentes ;
  - toutes boutiques : 216 ventes pour 496 850 FCFA.

## Limites

- Les écrans n'ont pas été essayés dans un navigateur.
- La suite (phase 2) n'est pas faite : comparaison des boutiques, suivi par vendeur, ancienneté des dettes et recouvrement, meilleurs clients et clients perdus, heures d'affluence, export PDF et Excel.
- L'accueil n'a pas encore la mini-courbe des ventes ni le rappel « à racheter dans les 7 jours ».
