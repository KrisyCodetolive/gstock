# F7 — Tableau de bord et journal d'activité

> **Statut : terminée** (branche `front-tableau-de-bord`).
> Livrable du cahier (§11.4) : « Tableau de bord réel ». Modules M13, M14, règles §7.8.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `2881ca3` | **Tableau de bord et journal simulés** (`src/mocks/handlers/dashboard.ts`, `src/mocks/audit.ts`) ; journalisation de toutes les actions sensibles du M14 ; **dates de la démo relatives au jour d'ouverture** (`src/mocks/data/dates.ts`). |
| `75bb796` | Écrans : tableau de bord sur l'accueil `/` et journal d'activité `/journal`. |

Avec F7, **toutes les rubriques du menu sont livrées** : plus aucune n'affiche « Bientôt disponible ».

### Dates de démonstration relatives

Jusqu'à F6, l'historique s'arrêtait à une date fixe (3 novembre 2026) : le tableau de bord « Aujourd'hui » aurait été vide dès le lendemain. Désormais tout est calculé à partir du jour où la démo est générée : stock de départ 34 jours avant, ventes des 30 derniers jours **jusqu'à maintenant** (les ventes du jour sont réparties entre minuit et l'heure d'ouverture), échéances en retard et à venir, approvisionnements et dépenses du mois. Le générateur reste déterministe (mêmes données à heure égale). La clé de la base simulée passe à `gstock.mock.db.v6`.

## Écrans

| Adresse | Écran | Permission |
|---|---|---|
| `/` | **Tableau de bord** : période (aujourd'hui, 7 jours, 30 jours), bascule « Cette boutique / Toutes mes boutiques » (propriétaire avec plusieurs boutiques), six cartes, actions rapides, échéances, activité récente. Sans `dashboard.view` : l'accueil de F1 (actions rapides seules). | `dashboard.view` |
| `/journal` | **Journal d'activité** : liste filtrable par type d'action et cherchable ; le détail (motif, avant / après) s'ouvre en panneau. | `audit.view` |

Les six cartes (M13), chacune cliquable et affichée selon les permissions :

| Carte | Contenu | Ouvre | Permission |
|---|---|---|---|
| Ventes | Total, nombre, part à crédit, comparaison avec la période d'avant (« par rapport à hier ») | `/ventes?periode=` | `sales.view` |
| Argent reçu | Total et répartition par mode de paiement | `/ventes?periode=` | `sales.view` |
| Stock faible | Produits à racheter, dont ruptures | `/stock?state=low` | `stock.view` |
| Crédits clients | Reste à récupérer, nombre de clients | `/credits` | `credits.view` |
| Dépenses | Total ; argent rendu aux clients s'il y en a | `/depenses?periode=` | `expenses.view` |
| Résultat estimé | Ventes − prix d'achat des produits vendus − dépenses ; « incomplet » s'il manque des prix d'achat | panneau « détail du calcul » | `sales.view` et `expenses.view` |

Actions rapides (M13), selon les permissions : Vendre, Ajouter un produit, Ajouter un client, Recevoir un paiement, Ajouter un approvisionnement, Enregistrer une dépense (`/depenses?ajouter=1` ouvre directement la saisie).

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/mocks/handlers/dashboard.ts` | `buildDashboard` (calcul §7.8), `recentActivity`, endpoints tableau de bord et journal. |
| `src/mocks/audit.ts` | `audit(user, action, { shopId, subject, reason, old, new })`. |
| `src/mocks/data/dates.ts` | `daysAgo`, `dayFromToday`, `DEMO_START` : dates de démo relatives. |
| `src/types/dashboard.ts`, `src/lib/api/dashboard.ts` | Contrat et appels. |
| `src/features/dashboard/` | `hooks.ts`, `pages/HomePage.tsx` (tableau de bord), `pages/AuditPage.tsx`. |
| `src/locales/fr/audit.json` | Libellés des actions, domaines et champs du journal. |

## Endpoints

Prévus par le cahier : `GET /shops/{id}/dashboard?period=`, `GET /dashboard?period=` (toutes les boutiques), `GET /audit-logs`.

Précisions à reporter dans le cahier :
- `period` accepte `today`, `week` (7 derniers jours), `month` (30 derniers jours) ;
- la réponse détaille `sales`, `money_in` (avec `by_method`), `money_out` (dépenses, argent rendu aux clients, paiements fournisseurs), `stock`, `credits`, `result` (avec `complete`), `installments` et `recent` ;
- `GET /dashboard` est réservé au propriétaire (403 sinon) ;
- `GET /audit-logs` accepte `filter[domain]` (`sale`, `stock`, `credit`, `repayment`, `purchase`, `expense`, `role`, `user`, `payment_settings`), `filter[user_id]`, `filter[shop_id]`, `filter[from]`, `search`.

## Règles appliquées

- **Distinction financière (§7.8)** : une vente à crédit compte dans les ventes mais pas dans l'argent reçu ; un remboursement compte dans l'argent reçu mais pas dans les ventes ; **argent reçu = payé immédiatement + remboursements reçus**, les paiements par **avoir en sont exclus** (point laissé ouvert en F5) ; l'argent rendu aux clients et les paiements aux fournisseurs sont des sorties, à part.
- Ventes annulées exclues ; sans `records.view_all`, les chiffres portent sur ses propres opérations.
- Résultat estimé avec le prix d'achat enregistré sur chaque ligne de vente au moment de la vente.
- **Journal (M14)** : annulation de vente, prix modifié à la caisse, mouvement de stock manuel et son annulation, ancienne dette, annulation et régularisation de crédit, annulation de paiement de crédit, annulation d'approvisionnement et de dépense, création / modification / suppression de rôle, changement de rôle, d'affectations ou d'activation d'un utilisateur, changement des clés de paiement. **Jamais de secret** (pour les clés, seulement « changée : oui / non ») et **jamais de code technique** à l'écran (les permissions sont enregistrées par leur libellé français, ajoutées et retirées).
- Les actions sans boutique (rôles, utilisateurs, paramètres) ne sont visibles que du propriétaire.

## Vérifications faites

- **Appels directs** : pour chaque période, argent reçu = payé immédiatement + remboursements, et = somme des modes de paiement ; ventes, dépenses et résultat calculés ; vue toutes boutiques pour le propriétaire, 403 pour le vendeur ; journal 403 pour le vendeur.
- **Navigateur, mobile et desktop** : cartes du jour, de la semaine et de toutes les boutiques ; détail du résultat (ventes 28 000 − prix d'achat 20 725 − dépenses 41 500) ; carte stock → liste filtrée ; activité récente → détail de la vente ; action rapide dépense → formulaire ouvert ; annulation d'une vente et modification d'un rôle → visibles dans le journal avec leur détail en français ; le vendeur voit 4 cartes (ventes, argent reçu, stock, crédits) et pas de journal.
- Tous les scénarios de F1 à F6 repassent ; démo cohérente.

## Limites

- En vue « Toutes mes boutiques », les cartes ouvrent les listes de la boutique courante, et les lignes d'activité ne sont pas cliquables (leur boutique peut être différente).
- Pas de graphique d'évolution (non demandé par le cahier ; le skill `dataviz` est disponible).
- Les ventes d'avant la démo n'existent pas : sur « 30 derniers jours », la comparaison avec la période précédente est très élevée.
- Le journal ne couvre que les actions faites depuis la génération de la démo (plus une annulation de vente d'exemple).
