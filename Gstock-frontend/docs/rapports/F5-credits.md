# F5 — Crédits clients

> **Statut : à faire. C'est la prochaine phase.** Branche à créer depuis `main` : `front-credits`.
> Livrable du cahier (§11.4) : « Module crédit complet ». Module M09, règles §7.6 et §7.7.

## Objectif

Savoir précisément qui doit combien, pour quels achats, ce qui a été remboursé et ce qui reste à récupérer. GStock **enregistre** les crédits accordés par le commerçant : il ne décide jamais d'accorder un crédit, ne note pas les clients et ne relance pas automatiquement.

## Périmètre (M09)

- **Cartes** : total restant à récupérer, clients qui me doivent, nouveaux crédits (période), remboursements reçus (période). Chaque carte ouvre sa liste.
- **Liste des débiteurs** [LISTE] : nom, téléphone, total à crédit, déjà remboursé, reste, dernière opération ; recherche, filtre et tri par solde.
- **Fiche crédit du client** : total à crédit, total remboursé, solde (par boutique et total), crédits avec leur origine (vente et articles), remboursements, corrections et annulations.
- **Solde initial** `CR-N` : dette existante saisie sans vente (permission `credits.opening_balance`).
- **Remboursement** `RB-N` : montant reçu, date et heure, mode de paiement, note ; partiel ou total ; **affectation** proposée du crédit le plus ancien au plus récent, modifiable, jamais au-delà du montant reçu.
- **Échéancier** facultatif sur un crédit ; vue des échéances en retard et à venir (7 jours).
- **Reçu de remboursement** (boutique, client, montant, date, mode, solde restant, `RB-N`) : impression ou WhatsApp, comme le reçu de vente.
- **Annulation** d'un crédit ou d'un remboursement avec motif ; **régularisation** d'un crédit (geste commercial, erreur) avec motif.

Endpoints prévus par le cahier : `GET /shops/{id}/credits/summary?from=&to=`, `GET /shops/{id}/credits/debtors`, `GET /customers/{id}/credits`, `POST /shops/{id}/credits/opening-balance`, `POST /shops/{id}/credits/{id}/cancel`, `POST /shops/{id}/credits/{id}/adjustments`, `GET|PUT /shops/{id}/credits/{id}/installments`, `POST /shops/{id}/repayments`, `POST /shops/{id}/repayments/{id}/cancel`, `GET /shops/{id}/repayments/{id}/receipt`, `GET /shops/{id}/installments?status=overdue`.

Permissions : `credits.view`, `credits.create`, `credits.cancel`, `credits.opening_balance`, `repayments.create`, `repayments.cancel`, `records.view_all`.

## Règles à respecter

- **Reste d'un crédit = montant − Σ affectations − Σ régularisations.** Solde d'un client = Σ restes de ses crédits ouverts (§7.6).
- États : `open` (rien remboursé), `partial`, `settled` (reste 0), `cancelled`.
- Un remboursement augmente l'argent reçu mais ne crée pas de vente et ne touche pas au stock (§7.1, §7.8).
- Annuler un remboursement libère ses affectations et recalcule les restes.
- Échéances (§7.7) : somme = reste dû à la création ; soldées de la plus ancienne à la plus récente ; statuts `pending`, `partial`, `paid`, `overdue` ; une échéance payée n'est plus modifiable ; aucune relance automatique.
- Critère d'acceptation : 25 000 − 10 000 − 5 000 = **10 000 FCFA** restants.
- Remboursement hors ligne en espèces prévu en F9 : envoyer déjà un `offline_uuid`.

## Ce qui existe déjà

- **Crédits** : table simulée `db.credits` (`MockCredit` dans `src/mocks/data/customers.ts`), créée automatiquement par `recordSale` (`src/mocks/sales.ts`). Le type `CustomerCredit` est dans `src/types/customers.ts`. Il y a des données de démo : environ 45 crédits issus de ventes et 3 soldes initiaux `CR-1` à `CR-3` sur 15 clients.
- **Références** : `db.sequences` contient déjà `CR` ; ajouter `RB`. Utiliser `nextReference()` (`src/mocks/db.ts`).
- **Solde** : `customerBalance()` (`src/mocks/sales.ts`) ; à faire évoluer pour tenir compte des affectations et régularisations.
- **Fiche client** (`/clients/:id`) : affiche déjà les crédits et un bouton « Enregistrer un remboursement » qui mène à `/credits?client=…`. **Ce lien doit ouvrir le remboursement de ce client.**
- **Navigation** : la rubrique `credits` (`/credits`) a encore `phase: 'F5'` dans `src/app/navigation.ts` ; la retirer et ajouter les routes.
- **À réutiliser** : `DataList`, `ResponsiveSheet`, `CancelDialog`, `Money`, `StatusBadge`, `CustomerPicker` (`src/features/pos/components/`), `ReceiptTicket` (s'en inspirer pour le reçu de remboursement), le partage `share-link` / `/recu/:token` de F4.

## Décisions à prendre

- **P3** : annulation d'une vente à crédit déjà partiellement remboursée. Recommandation du cahier : les remboursements deviennent un **avoir client** réaffectable. Aujourd'hui `cancelSale` refuse (409). Une fois la décision prise, adapter `cancelSale` et l'affichage de la fiche client (avoir).
- Mode de paiement GeniusPay pour un remboursement : même logique « en attente jusqu'au webhook » que les ventes.

## Points d'attention

- La clé de cache des données de boutique doit contenir l'id de la boutique ; après un remboursement, invalider `customers`, `sales` (crédit de la vente) et la future clé `credits`.
- Les soldes sont **toujours calculés par le serveur** : l'écran d'affectation peut proposer une répartition, mais le reste affiché après validation vient de l'API.
