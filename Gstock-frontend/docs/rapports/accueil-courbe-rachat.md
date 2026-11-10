# Accueil : mini-courbe des ventes et rappel « à racheter »

| | |
|---|---|
| **Statut** | Livrée le 10 novembre 2026 |
| **Branche** | `accueil-courbe-rachat` |
| **Cahier** | M13 (v3.10), suite des « Limites » de [rapports-statistiques.md](rapports-statistiques.md) |

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier)` | Cahier v3.10 : mini-courbe des ventes et rappel « à racheter dans les 7 jours » (M13) |
| `feat(api)` | `trend` et `restock` dans la réponse du tableau de bord ; calcul commun avec « À racheter bientôt » des rapports ; test |
| `feat(front)` | `SalesSparkline` dans la carte « Ventes », bloc `RestockSoon` sur l'accueil |

## Écrans

| Écran | Adresse | Permission |
|---|---|---|
| Mini-courbe dans la carte « Ventes » | `/` | `dashboard.view` + `sales.view` (comme la carte) |
| Bloc « À racheter dans les 7 jours » | `/` | `dashboard.view` + `stock.view` |
| Bouton « Racheter chez lui » | `/`, vue d'une boutique | `purchases.create` |
| Lien « Voir les N » | `/` → `/rapports?onglet=produits` | `reports.view` |

**Mini-courbe.**
- Elle montre les ventes jour par jour : les 7 derniers jours pour « Aujourd'hui » et « 7 derniers jours », les 30 derniers pour « 30 derniers jours ». Aujourd'hui est toujours le dernier point.
- C'est une seule courbe indigo, avec une aire légère et un point sur aujourd'hui. Elle n'a pas d'axe, et les jours sans vente valent 0.
- Sous la courbe s'affichent le nombre de jours et la meilleure journée (« Meilleur : 12 500 FCFA le 4 nov. »).
- La carte entière reste un lien vers « Mes ventes » : la courbe n'a pas d'info-bulle. Les lecteurs d'écran en lisent un résumé (meilleure journée et aujourd'hui). Le détail jour par jour est dans les rapports.

**À racheter dans les 7 jours.**
- Le bloc annonce le nombre d'articles concernés, puis liste les 5 plus urgents. Pour chacun : la photo, le nom (et la variante), le stock restant, le fournisseur habituel, et le badge « En rupture » (rouge) ou « N jours de stock » (orange).
- Chaque article ouvre sa fiche.
- Le bouton « Racheter chez lui » ouvre l'approvisionnement avec le fournisseur choisi (`?fournisseur=`), ce qui affiche le panneau « Ses produits à racheter ». Il n'apparaît pas dans la vue « Toutes mes boutiques », car un approvisionnement se fait dans une boutique.
- Quand aucun article n'est concerné, une phrase le dit : « Aucun produit ne risque de manquer dans les 7 jours, au rythme des ventes. »

## Endpoints

La réponse de `GET /shops/{id}/dashboard?period=` et de `GET /dashboard?period=` gagne deux champs :
- `trend` : `[{date: "Y-m-d", total}]`, sur 7 ou 30 jours, aujourd'hui compris ;
- `restock` : `{horizon_days: 7, count, items}`. `items` contient les 5 plus urgents, sous la même forme que `restock.items` du rapport des produits (`days_left`, `quantity`, `per_day`, `suggested_quantity`, `supplier`).

## Règles et décisions

- **Calcul commun.** Le rappel reprend le calcul de « À racheter bientôt » (M15) :
  - le rythme de vente se mesure sur les 30 derniers jours ;
  - seuls les articles vendus sur cette durée comptent ;
  - jours restants = stock ÷ vente par jour, arrondi vers le bas.

  Seul l'horizon change : 7 jours sur l'accueil, 14 dans les rapports. `ReportService::restockSoon()` et `restockItems()` servent aux deux.
- **Courbe : seulement ses propres ventes.** Sans `records.view_all`, la courbe ne compte que les ventes de l'utilisateur, comme le montant de la carte.
- **Rappel : l'état de la boutique.** Le rappel décrit l'état du stock, comme les alertes de stock : toutes les ventes de la boutique comptent dans le rythme.
- **Vue « Toutes mes boutiques ».** Le stock et les ventes de toutes les boutiques sont réunis par article.
- **Réponse ancienne gardée hors ligne.** Le front accepte une réponse sans `trend` ni `restock` : la courbe et le bloc ne s'affichent simplement pas.
- **Courbe dessinée sans bibliothèque.** C'est du SVG à l'échelle de la carte (`preserveAspectRatio="none"`, trait de 2 px gardé par `vector-effect`). Le point d'aujourd'hui est un élément HTML, pour rester rond quelle que soit la largeur de la carte.

## Vérifications

- Backend :
  - les 115 tests passent, et pint ne signale rien ;
  - le nouveau test de `DashboardTest` couvre :
    - 7 points ou 30 selon la période, les jours sans vente à 0, aujourd'hui en dernier ;
    - le pain (2 restants, 6 jours) dans le rappel, mais pas le sucre (13 jours), qui figure dans le rapport à 14 jours ;
    - le fournisseur habituel ;
    - un vendeur sans `records.view_all`, dont la courbe ne compte que ses ventes alors que son rappel reste celui de la boutique.
- Frontend : `typecheck`, `lint` et `build` passent.
- API Docker sur les données de démonstration (boutique Cocody, connecté comme propriétaire) :
  - sur 7 jours, la somme de la courbe (4 850 FCFA) égale le total de la carte, et de même sur 30 jours (223 700 FCFA) ;
  - le rappel est vide : le seul article à racheter des données de démonstration tient 11 jours.

## Limites

- Les écrans n'ont pas été essayés dans un navigateur.
- La courbe n'a pas d'info-bulle par jour : la carte est un lien, et le détail est dans les rapports.
- Le rappel ne tient pas compte des approvisionnements déjà commandés : GStock n'a pas de commande fournisseur, l'approvisionnement est enregistré à la réception.
