# Transferts de stock entre boutiques

| | |
|---|---|
| **Statut** | Livrée le 5 novembre 2026 |
| **Branches** | `cahier-transferts`, puis `transferts` |
| **Cahier** | §7.12 (nouveau), §6.3, §7.2, §7.8, §7.9, §8.4, M07, M13, M14, P14 — version 3.2 ; avancé de la phase 2 à la phase 1 |

## Décisions du propriétaire du projet

- Transferts entre boutiques **d'un même espace** (entre deux espaces : vente pour l'un, approvisionnement pour l'autre).
- **Envoi puis réception**.
- Permission **`stock.transfer`**, accordée par défaut au seul propriétaire, que le propriétaire peut donner à n'importe quel rôle.

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier): transferts de stock entre boutiques (§7.12)…` | règles, droits, tables, endpoints, écrans |
| `feat(api): transferts de stock entre boutiques (§7.12)…` | migration, service, contrôleur, tableau de bord, tests |
| `feat(front): transferts entre boutiques…` | écrans |

## Écrans

| Écran | Adresse | Permission |
|---|---|---|
| Liste des transferts envoyés et reçus (filtres Tous, En route, Reçus, Annulés) | `/stock/transferts` | `stock.view` |
| Envoi : boutique qui reçoit, produits, quantités, note | `/stock/transferts/nouveau` (bouton « Transférer » dans Mon stock et sur la liste) | `stock.transfer` |
| Détail ; réception (quantités reçues, remarque) pour la boutique d'arrivée ; annulation pour celle de départ | `/stock/transferts/:id` | `stock.view` (réception : `stock.entry` ; annulation : `stock.transfer`) |
| Rappel « N transferts à réceptionner » | `/` et `/stock` | `stock.view` |

## Fichiers clés et endpoints

- Backend : migration `2026_11_09_000100_create_stock_transfers_tables.php` (tables et permission) ; `app/Domain/Stock/TransferService.php` (envoi, réception, annulation) ; `StockLots::takenBy()` (dates parties, recréées à l'arrivée) et `transfer_cancel` dans les annulations rendues à leur arrivage ; `app/Http/Controllers/Api/V1/TransferController.php` ; `DashboardService` (`transfers.to_receive`, pertes `by_reason.transfer`, activité `transfer`) ; `tests/Feature/TransferTest.php`.
- Frontend : `src/features/stock/pages/{TransfersPage,TransferFormPage,TransferDetailPage}.tsx`, `components/{TransferStatusBadge,TransfersToReceive}.tsx`, `src/lib/api/transfers.ts`, types dans `src/types/stock.ts`.
- Endpoints : `GET /shops/{id}/transfers?direction=out|in&filter[status]=` (avec `summary.to_receive`), `POST /shops/{id}/transfers`, `GET /shops/{id}/transfers/{id}`, `POST /shops/{id}/transfers/{id}/receive`, `POST /shops/{id}/transfers/{id}/cancel`. Mouvements `transfer_out`, `transfer_in`, `transfer_cancel` ; référence `TR-N` ; journal `transfer.sent`, `transfer.received`, `transfer.cancelled`.

## Règles appliquées (§7.12)

- Le stock sort à l'envoi (jamais au-delà du stock), entre à la réception pour la quantité reçue ; en route, il n'est compté nulle part.
- Réception en une fois, jamais plus que l'envoyé ; le manque, au prix d'achat, compte dans les pertes de la boutique d'arrivée.
- Annulation seulement avant réception, par la boutique de départ, motif obligatoire ; la marchandise revient dans ses arrivages d'origine.
- Dates de péremption et prix d'achat suivent la marchandise ; un manque est pris sur les dates les plus lointaines.

## Vérifications

- Backend : 108 tests passent, dont 4 sur les transferts (envoi et réception avec manque, annulation, droits et stock insuffisant, dates et prix d'achat).
- Frontend : `typecheck`, `lint`, `build`.
- Navigateur (Chrome, mobile, contre l'API locale) : envoi de Cocody vers Yopougon, rappel sur l'accueil de Yopougon, réception de 2 kg sur 3 avec « Manque de 450 FCFA, compté dans les pertes ».

## Limites

- La boutique d'arrivée se choisit parmi les boutiques auxquelles l'expéditeur a accès (le serveur accepte toute boutique active de l'espace).
- Pas de réception en plusieurs fois ; pas de transfert hors ligne.
