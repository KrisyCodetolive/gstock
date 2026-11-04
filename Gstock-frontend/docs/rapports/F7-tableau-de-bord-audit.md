# F7 — Tableau de bord et journal d'activité

> **Statut : à faire.** Branche suggérée : `front-tableau-de-bord`.
> Livrable du cahier (§11.4) : « Tableau de bord réel ». Modules M13, M14, règles §7.8.

## M13 — Tableau de bord (sur l'accueil `/`)

Décidé avec le propriétaire du projet : le tableau de bord **remplace l'accueil actuel** (`src/features/dashboard/pages/HomePage.tsx`), sans écran séparé. Organisation validée :

1. En tête : période (aujourd'hui par défaut) et, pour le propriétaire, bascule boutique courante / « Toutes mes boutiques ».
2. Six cartes cliquables : **Ventes du jour** (montant, nombre, comparaison avec la veille → `/ventes`), **Argent reçu** (répartition par mode de paiement), **Stock faible** (→ `/stock?state=low`), **Crédits clients** (reste à récupérer, nombre de clients → `/credits`), **Dépenses** (→ `/depenses`), **Résultat estimé** (si les prix d'achat sont renseignés).
3. Actions rapides (les cartes actuelles) : Vendre, Ajouter un produit, Ajouter un client, Enregistrer un remboursement, Ajouter un approvisionnement, Enregistrer une dépense.
4. Échéances en retard et à venir (7 jours).
5. Activité récente : ventes, crédits, remboursements, approvisionnements, dépenses, mouvements ; chaque ligne ouvre son détail.

- Endpoints : `GET /shops/{id}/dashboard?period=today`, `GET /dashboard?period=today` (toutes les boutiques).
- Les cartes affichées dépendent des permissions ; sans `dashboard.view`, seulement les actions rapides.
- **Tous les chiffres viennent de l'API** (§7.8 : une vente à crédit est une vente mais pas un encaissement ; un remboursement est un encaissement mais pas une vente ; argent reçu = payé immédiatement + remboursements).
- Le skill `dataviz` est disponible si une carte doit afficher une petite courbe.

## M14 — Journal d'activité (`/journal`)

- Journalisation automatique des actions sensibles : annulation de vente, modification de prix, mouvement de stock manuel, annulation ou régularisation de crédit, annulation de remboursement, modification des rôles, permissions et affectations, changement des clés de paiement.
- Consultation [LISTE] (permission `audit.view`) : date, utilisateur, boutique, action, objet, motif, avant / après.
- Endpoint : `GET /audit-logs`.

## Ce qui existe déjà

- Toutes les données nécessaires sont dans la base simulée après F5 et F6 : ventes et paiements (`db.sales`), crédits, mouvements de stock, prix d'achat (`unit_cost` sur chaque ligne de vente pour le coût des produits vendus).
- Aucune table d'audit simulée : ajouter `db.auditLogs` et une fonction `audit(user, action, subject, before, after, reason)` appelée par les handlers concernés (`cancelSale`, annulation de mouvement, `PUT /roles`, `PUT /users/{id}/shops`, `PUT /settings/payment`…).
- Navigation : rubrique `audit` avec `phase: 'F7'`.
