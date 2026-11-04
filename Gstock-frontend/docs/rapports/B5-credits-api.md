# B5 — Crédits clients (backend)

> **Statut : terminée** (branche `api-credits`).
> Étape 4 du planning (§15) : M09 « Mes crédits clients ». Contexte Crédits en DDD complet (ADR-001).

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `a1ee478` | Paiements `RB-N` répartis sur plusieurs dettes ; anciennes dettes `CR-N` ; échéanciers ; régularisations ; avoirs et décision P3 (avoir ou argent rendu) ; avoir utilisé à la caisse et pour un paiement ; reçus de paiement et liens signés ; anciennes dettes et paiements de démonstration ; 9 tests. |

## Endpoints

Sous `/api/v1`, sur le sous-domaine de l'espace. Les formes JSON sont identiques à `Gstock-frontend/src/types/credits.ts`, et les règles reprennent celles de `src/mocks/credits.ts`.

| Endpoint | Permission |
|---|---|
| `GET /shops/{id}/credits/summary` (`from`, `to` : reste à récupérer, nouveaux crédits, paiements reçus, échéances en retard) | `credits.view` |
| `GET /shops/{id}/credits/debtors` (`search` : « Qui me doit », un client par ligne) | `credits.view` |
| `GET /shops/{id}/credits` (`search`, `filter[status\|customer_id\|from\|to]`) | `credits.view` |
| `GET /customers/{id}/credits` (fiche crédit : crédits, paiements, avoirs, argent rendu, totaux par boutique accessible) | `credits.view` |
| `POST /shops/{id}/credits/opening-balance` (ancienne dette `CR-N`) | `credits.opening_balance` |
| `POST /shops/{id}/credits/{id}/cancel` (`reason`, plus `refund_mode` et `refund_payment_method_id` si de l'argent a déjà été reçu) | `credits.cancel` |
| `POST /shops/{id}/credits/{id}/adjustments` (`amount` signé, `reason`) | `credits.cancel` |
| `GET\|PUT /shops/{id}/credits/{id}/installments`, `GET /shops/{id}/installments` (`status=overdue\|upcoming`) | `credits.view` / `credits.create` |
| `POST /shops/{id}/repayments` (répartition automatique ou `allocations`, `use_credit_note`, `offline_uuid` idempotent) | `repayments.create` |
| `GET /shops/{id}/repayments`, `GET …/{id}`, `GET …/{id}/receipt`, `POST …/{id}/share-link` | `credits.view` ou `repayments.create` |
| `POST /shops/{id}/repayments/{id}/cancel` (`reason` obligatoire) | `repayments.cancel` |
| `POST /shops/{id}/sales/{id}/cancel` : accepte maintenant `refund_mode` et `refund_payment_method_id` (P3) | `sales.cancel` |
| `GET /public/receipts/{token}` : sert aussi les reçus de paiement (`kind: "repayment"`) | lien signé |

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_11_05_000400_create_credit_tables.php` | Crée `credit_repayments`, `credit_repayment_allocations`, `credit_adjustments`, `credit_notes`, `customer_refunds` et `installments` (table générique : `payable_type` vaut `customer_credit` ou `purchase`). Ajoute à `customer_credits` le règlement de l'annulation (`cancel_settlement_mode`, `cancel_settlement_amount`). |
| `app/Domain/Credits/CreditLedger.php` | Seul calcul des soldes. Reste à payer = montant − paiements confirmés − régularisations. Calcule aussi le statut, verrouille les crédits ouverts (du plus ancien au plus récent), répartit automatiquement un paiement et tient le solde d'avoir (écritures signées dans `credit_notes`). |
| `app/Domain/Credits/CreditService.php` | Gère les anciennes dettes, l'annulation d'un crédit, la décision P3 (`checkSettlement` / `applySettlement`, partagés avec l'annulation d'une vente), les régularisations et les échéanciers. |
| `app/Domain/Credits/RepaymentService.php` | Enregistre un paiement `RB-N` (verrous, plafond, répartition, avoir, statut `pending` si GeniusPay est actif) et l'annule. |
| `app/Domain/Credits/InstallmentSchedule.php` | Échéancier générique : remplacement validé, échéances payées gelées, statut calculé à la lecture. Il servira aux approvisionnements (B6). |
| `app/Domain/Sales/SaleService.php` | À la caisse, l'avoir sert de moyen de paiement. À l'annulation d'une vente, l'avoir utilisé est rendu au client et le choix P3 est demandé si le crédit a déjà reçu un paiement. |
| `app/Http/Resources/CreditsPresenter.php` | Formes JSON : crédit, élément de liste, paiement (avec `balance_after`), argent rendu, reçu. |
| `app/Http/Controllers/Api/V1/CreditController.php`, `RepaymentController.php` | Endpoints. |
| `database/seeders/DemoSalesSeeder.php` | Trois anciennes dettes (7 500, 12 000 et 4 500 FCFA) et des paiements partiels quelques jours après chaque crédit. |
| `tests/Feature/CreditsTest.php` | 9 tests. |

## Règles du cahier appliquées

- **§7.6, paiements** :
  - un paiement se répartit sur les dettes de la boutique, de la plus ancienne à la plus récente, ou selon une répartition manuelle qui doit égaler exactement le montant ;
  - il ne dépasse jamais ce que le client doit dans la boutique ;
  - il est refusé si une dette reçoit plus que son reste.

  L'exemple du cahier est vérifié : 25 000 − 2 000 − 5 000 = 18 000.
- **§7.6, anciennes dettes** : une dette antérieure à GStock reçoit une référence `CR-N`, est marquée « Ancienne dette » et est journalisée (`credit.opening_balance`).
- **§7.7, échéanciers** :
  - le total des échéances doit égaler le reste à payer ;
  - les paiements règlent les échéances dans l'ordre ;
  - le statut de chaque échéance (`paid`, `partial`, `overdue`, `pending`) est calculé à la lecture ;
  - une échéance déjà payée ne se modifie plus.
- **Régularisations** :
  - elles exigent un motif ;
  - le reste à payer ne peut ni devenir négatif ni dépasser le montant du crédit ;
  - elles sont journalisées (`credit.adjusted`).
- **P3** : quand on annule une vente ou une ancienne dette sur laquelle de l'argent a déjà été reçu, le commerçant doit choisir :
  - garder cet argent en **avoir** pour le client ;
  - ou le **rendre**, ce qui crée une sortie d'argent `customer_refunds` avec son mode de paiement.

  Le paiement concerné ne peut plus être annulé ensuite (409).
- **Avoirs** : l'avoir sert à payer une dette (`use_credit_note`) ou un achat à la caisse (`credit_note: true`), dans la limite de son solde. Il est rendu au client si la vente ou le paiement est annulé.
- **ADR-012** : un paiement ne se supprime ni ne se modifie. Son annulation exige un motif et rend leur reste aux dettes qu'il réglait ; une double annulation renvoie 409 ; l'action est journalisée (`repayment.cancelled`). Le crédit d'une vente ne s'annule qu'en annulant la vente (409 sinon).
- **ADR-005** : `offline_uuid` est idempotent. Un second envoi renvoie le paiement déjà enregistré, avec le statut 200.
- **ADR-003** : un paiement par un mode GeniusPay reste `pending` si GeniusPay est actif. Il ne compte dans les soldes qu'une fois confirmé.
- **ADR-013** : le reçu de paiement se partage par un lien signé valable 7 jours. Le message WhatsApp rappelle le reste à payer.
- **§6.2** : l'affectation à la boutique est vérifiée. Sans `records.view_all`, on ne voit que ses propres paiements. La fiche crédit ne totalise que les boutiques accessibles.

## Décisions prises pendant la phase

- **Avoir tenu en écritures signées** (`credit_notes` : `+` à la création, `−` à l'usage, `+` au retour). Le solde est leur somme : rien n'est stocké en double, et l'historique de l'avoir reste lisible.
- **Une table d'échéances commune** aux crédits clients et aux dettes fournisseurs (`payable_type`). Elle évite de dupliquer la règle pour B6.
- **Régularisation sous `credits.cancel`**, comme dans les données simulées : c'est le même niveau de confiance qu'une annulation.
- **Verrouillage des dettes ouvertes du client** (`lockForUpdate`, ordre fixe) pendant un paiement : deux paiements simultanés ne peuvent pas régler deux fois la même dette.
- **Paiements de démonstration enregistrés par le gérant** (Ibrahim Traoré) avec le vrai service, et répartis explicitement sur le crédit visé.

## Vérifications faites

- **66 tests passent** (541 assertions), dont 9 nouveaux. Ils couvrent :
  - la répartition de la plus ancienne dette à la plus récente, et les soldes du client ;
  - les plafonds et les messages de la répartition manuelle ;
  - l'annulation d'un paiement ;
  - la décision P3 dans ses deux modes, pour une ancienne dette et pour une vente ;
  - l'avoir à la caisse et son retour à l'annulation ;
  - les régularisations ;
  - les échéanciers et les retards ;
  - la synthèse et la liste « Qui me doit » ;
  - les permissions ;
  - le reçu public ;
  - l'idempotence.
- **Données de démonstration** : 41 crédits dont 3 anciennes dettes et 21 paiements, pour 71 800 FCFA de reste à payer. Aucun écart entre les soldes et les répartitions.
- **Navigateur** (frontend en `dev:api`) : l'écran « Mes crédits clients » a été parcouru avec ses cartes et ses quatre onglets, puis la fiche crédit d'une cliente. On y a reçu un paiement en espèces (`RB-22`), affiché son détail et son reçu, annulé ce paiement avec un motif et saisi une ancienne dette (`CR-4`). Seule erreur relevée : le 401 attendu sur `/me` avant la connexion.
- `vendor/bin/pint` passe.

## Limites

- **GeniusPay** : les paiements restent `pending` tant que le webhook n'existe pas (étape 6). La démo n'active pas GeniusPay.
- **Synchronisation hors ligne** (`POST /shops/{id}/sync`) : prévue à l'étape 7. Le service est déjà idempotent.
- **Dettes fournisseurs** : l'échéancier générique est prêt, mais les approvisionnements arrivent en B6.
- **Tableau de bord** : l'argent rendu (`customer_refunds`) y sera compté comme une sortie d'argent (§7.8), à l'étape du tableau de bord.
