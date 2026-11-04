# F5 — Crédits clients

> **Statut : terminée** (branche `front-credits`).
> Livrable du cahier (§11.4) : « Module crédit complet ». Module M09, règles §7.6, §7.7, §7.8, décision P3.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `648a57f` | **Décision P3** reportée dans le cahier (§7.6 et §17) : à l'annulation d'une vente ou d'un crédit déjà en partie payé, le commerçant choisit de garder l'argent en **avoir** au nom du client ou de le **rendre**. |
| `644177c` | **Moteur de crédits simulé** (`src/mocks/credits.ts`) : remboursements `RB-N`, affectations, échéances, régularisations, avoir et argent rendu ; endpoints simulés ; remboursements et échéances dans la démo. |
| `e95ff69` | Écrans « Mes crédits clients » : cartes, débiteurs, crédits, paiements reçus, échéances, fiche crédit du client, paiement et reçu, ancienne dette, échéancier, régularisation, choix P3 (aussi dans l'annulation d'une vente). |
| `4b8b1e6` | Utiliser l'avoir du client pour payer à la caisse. |

Jeu de démonstration : l'historique de F4 est complété par environ 23 remboursements partiels (quelques jours après les crédits, en espèces ou Mobile Money) et 4 échéanciers, dont une échéance déjà en retard. Ils sont créés par les moteurs (`recordRepayment`, `setInstallments`) dans `src/mocks/data/sales-seed.ts`. La clé de la base simulée passe à `gstock.mock.db.v4`.

## Écrans

| Adresse | Écran | Permission |
|---|---|---|
| `/credits` | Cartes (reste à récupérer, nouveaux crédits, paiements reçus, échéances en retard) selon la période ; onglets **Qui me doit**, **Crédits**, **Paiements reçus**, **Échéances** (`?vue=`, `?periode=`) ; boutons « Recevoir un paiement » (choix du client) et « Saisir une ancienne dette » | `credits.view` |
| `/credits/clients/:id` | Fiche crédit du client : total à crédit, déjà payé, reste (total et par boutique), avoir ; crédits dépliables (origine et articles, paiements affectés, régularisations, échéancier, actions) ; paiements reçus ; argent rendu | `credits.view` |
| `/credits/clients/:id/paiement` | Recevoir un paiement : montant (bouton « Tout »), mode de paiement ou avoir, date et heure, note, **répartition** sur les dettes (proposée de la plus ancienne à la plus récente, modifiable) | `repayments.create` |
| `/credits/paiements/:id` | Paiement `RB-N` : détail, affectations, reste après paiement, reçu 58/80 mm, partage WhatsApp, annulation motivée | `credits.view` ou `repayments.create` (annuler : `repayments.cancel`) |
| `/recu/:token` | Reçu public : affiche maintenant un reçu de vente **ou** de paiement | aucune (lien signé) |

Panneaux sur la fiche crédit : **Ancienne dette** (`credits.opening_balance`), **Échéancier** (`credits.create`), **Régulariser** (`credits.cancel`), **Annuler le crédit** (`credits.cancel`, seulement pour une ancienne dette ; un crédit de vente s'annule avec sa vente).

Liens branchés : le bouton « Enregistrer un remboursement » de la fiche client (`/clients/:id`) ouvre directement le paiement de ce client ; l'ancien lien `/credits?client=…` y redirige aussi.

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/mocks/credits.ts` | **Moteur** : `recomputeCredit`, `openCredits`, `autoAllocate`, `recordRepayment`, `cancelRepayment`, `checkSettlement` / `applySettlement` (P3), `cancelCredit`, `adjustCredit`, `installmentsOf`, `setInstallments`, `creditNoteBalance`. |
| `src/mocks/handlers/credits.ts` | Endpoints simulés, et reçu public commun (ventes et paiements). |
| `src/mocks/receipt-token.ts` | Liens de reçu signés (`s` vente, `r` paiement), sortis de `handlers/sales.ts`. |
| `src/mocks/sales.ts` | `cancelSale` applique P3 ; paiement par avoir (`payment_method_id: null`). |
| `src/types/credits.ts`, `src/lib/api/credits.ts` | Contrat et appels. |
| `src/features/credits/` | `hooks.ts`, `pages/` (CreditsPage, CustomerCreditsPage, RepaymentFormPage, RepaymentPage), `components/` (CreditItem, CreditSheets, SettlementChoice, RepaymentTicket, badges). |
| `src/components/CancelDialog.tsx` | Accepte maintenant des choix supplémentaires (le choix P3). |

## Endpoints

Prévus par le cahier : `GET /shops/{id}/credits/summary?from=&to=`, `GET /shops/{id}/credits/debtors`, `GET /customers/{id}/credits`, `POST /shops/{id}/credits/opening-balance`, `POST /shops/{id}/credits/{id}/cancel`, `POST /shops/{id}/credits/{id}/adjustments`, `GET|PUT /shops/{id}/credits/{id}/installments`, `POST /shops/{id}/repayments`, `POST /shops/{id}/repayments/{id}/cancel`, `GET /shops/{id}/repayments/{id}/receipt`, `GET /shops/{id}/installments?status=overdue|upcoming`.

**Ajoutés** (à reporter dans le cahier) :
- `GET /shops/{id}/credits` (liste des crédits, onglet « Crédits ») ;
- `GET /shops/{id}/repayments` et `GET /shops/{id}/repayments/{id}` ;
- `POST /shops/{id}/repayments/{id}/share-link` ;
- `GET /public/receipts/{token}` renvoie `{ kind: 'sale' | 'repayment', … }` ;
- `POST /shops/{id}/sales/{id}/cancel` et `POST /shops/{id}/credits/{id}/cancel` acceptent `refund_mode` (`credit_note` | `refund`) et `refund_payment_method_id` (P3) ;
- `POST /shops/{id}/repayments` accepte `use_credit_note` et `offline_uuid` ;
- paiement de vente par avoir : `{ payment_method_id: null, credit_note: true, amount }` ;
- ressources : `credit_note_balance` sur le client, `credit.repaid_amount` sur la vente, `method` peut être `null` (avoir) sur un paiement de vente.

## Règles appliquées

- **Reste = montant − Σ affectations confirmées − Σ régularisations**, recalculé à chaque opération, jamais saisi ; états `open`, `partial`, `settled`, `cancelled` (§7.6).
- Solde d'un client = Σ restes de ses crédits ouverts, par boutique et au total.
- Remboursement : montant > 0, jamais supérieur à ce que doit le client dans la boutique ; répartition proposée du plus ancien au plus récent ; **la somme répartie est exactement le montant reçu** ; un remboursement ne crée pas de vente et ne touche pas au stock.
- Annuler un remboursement libère ses affectations ; refusé si une partie a déjà été transformée en avoir ou rendue lors d'une annulation.
- **P3** : annuler une vente (ou une ancienne dette) déjà en partie payée exige le choix « garder en avoir » (le client pourra payer avec) ou « rendre l'argent » (sortie d'argent enregistrée avec son mode) ; sinon 422.
- Avoir : suivi par client et par boutique ; utilisable pour payer une dette ou un achat à la caisse ; revient au client si le paiement ou la vente qui l'utilisait est annulé.
- Échéancier (§7.7) : total = reste dû ; échéances soldées de la plus ancienne à la plus récente ; `overdue` calculé automatiquement si la date est dépassée (pas besoin de tâche quotidienne dans la simulation) ; les échéances déjà payées sont gardées telles quelles quand on refait l'échéancier ; **aucune relance automatique**.
- Régularisation avec motif : diminue (geste commercial) ou augmente (erreur) le reste, sans le rendre négatif ni supérieur au montant.
- Paiement GeniusPay : « en attente » jusqu'au webhook (simulé : confirmé après 4 s) ; il ne réduit la dette qu'une fois confirmé.
- Références `RB-N` et `CR-N` par espace ; `offline_uuid` idempotent ; sans `records.view_all`, on ne voit que ses propres opérations.

## Vérifications faites

- **Appels directs au serveur simulé** : exemple du cahier 25 000 − 10 000 − 5 000 = **10 000 FCFA** (et le reçu affiche ce reste) ; montant supérieur à la dette refusé ; répartition incomplète refusée ; affectation automatique du plus ancien au plus récent ; annulation d'un remboursement → reste recalculé ; P3 sans choix refusé, avec avoir (avoir de 15 000 puis utilisé pour payer une dette), avec argent rendu ; échéance dépassée marquée en retard.
- **Navigateur, mobile et desktop** : cartes et 4 onglets ; formulaire de paiement (erreurs, « Tout », répartition) ; paiement puis reçu ; ancienne dette ; échéancier de 9 000 FCFA en 3 fois ; régularisation ; choix P3 obligatoire dans l'annulation d'une vente puis avoir visible sur la fiche ; vente payée avec l'avoir (1 000) et des espèces (3 500), avoir ramené à 0.
- **Cohérence de la démo** : aucun crédit dont le reste diffère de « montant − affectations − régularisations », aucun paiement dont la répartition diffère du montant, aucun écart de stock.
- Tous les scénarios de F1 à F4 repassent sans régression.

## Limites

- L'écran d'encaissement affiche « Argent reçu » en comptant l'avoir utilisé ; or un avoir n'est pas un encaissement (§7.8). **Le tableau de bord (F7) devra exclure les paiements par avoir de l'argent reçu**, et soustraire l'argent rendu au client.
- L'avoir est suivi par boutique ; la fiche client affiche le total des boutiques visibles : à la caisse, si l'avoir vient d'une autre boutique, le serveur refuse le paiement avec un message clair.
- Pas de remboursement hors ligne (prévu en F9 ; `offline_uuid` déjà envoyé).
- Pas de journal d'audit des annulations et régularisations (M14, F7).
