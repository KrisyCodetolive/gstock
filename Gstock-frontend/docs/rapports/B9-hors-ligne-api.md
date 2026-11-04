# B9 — Synchronisation hors ligne (backend)

> **Statut : terminée** (branche `api-hors-ligne`).
> ADR-005 et P2 du cahier : les ventes, paiements en espèces et dépenses faits sans réseau sont envoyés au retour de la connexion, enregistrés une seule fois, et jamais perdus.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `8db0ca2` | `POST /shops/{id}/sync` : un résultat par opération ; références définitives ; idempotence ; écarts « à vérifier » ; refus motivés ; horloge de l'appareil ; pas de GeniusPay hors ligne ; 4 tests. |

Une partie de ce comportement existait déjà, et la synchronisation s'appuie dessus :
- les services savaient enregistrer une opération faite hors ligne : vente au prix de l'appareil avec stock jamais négatif (B4), paiements de crédit (B5), dépenses (B6) ;
- ils étaient idempotents par `offline_uuid`.

## Endpoint

`POST /api/v1/shops/{id}/sync`, avec `{operations: [{type, offline_uuid, occurred_at, payload}]}`. Les formes sont celles de `Gstock-frontend/src/types/sync.ts`, et les règles reprennent celles de `src/mocks/handlers/sync.ts`.

- **Accès** :
  - l'affectation à la boutique est vérifiée ;
  - il faut au moins un des droits `sales.create`, `repayments.create`, `expenses.create`, puis le droit de chaque opération est vérifié une à une ;
  - 60 envois par minute ;
  - 200 opérations par envoi au plus.
- **Réponse** : `{data: [{offline_uuid, type, status, resource: {id, reference}, message, reasons}]}`, dans l'ordre d'envoi.

| Statut | Quand |
|---|---|
| `created` | Enregistrée ; le serveur attribue la référence définitive (`V-N`, `RB-N`, `DP-N`). |
| `duplicate` | Déjà reçue (même `offline_uuid`, par exemple si la réponse s'est perdue) : la même opération est renvoyée, rien n'est enregistré deux fois. |
| `to_review` | Vente enregistrée avec un écart : prix de l'appareil différent du prix actuel, ou stock insuffisant à la synchronisation. Le stock descend à 0, jamais en dessous ; `reasons` explique l'écart. |
| `rejected` | Impossible à enregistrer : droit retiré, client désactivé, paiement non espèces, opération illisible… L'appareil la garde et affiche `message`. |

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `app/Domain/Sync/SyncService.php` | Traite chaque opération seule : contrôle de forme, doublon, droit, horloge, mode de paiement, puis appel du vrai service (`SaleService` en mode hors ligne, `RepaymentService`, `ExpenseService`). Une erreur métier devient un refus motivé, sans bloquer les autres opérations. |
| `app/Http/Controllers/Api/V1/SyncController.php` | Endpoint. |
| `app/Domain/Sales/SaleCalculator.php` | Message d'écart de prix écrit comme dans les données simulées (« 1 200 FCFA », avec séparateur des milliers). |
| `tests/Feature/SyncTest.php` | 4 tests. |

## Règles du cahier appliquées

- **ADR-005, idempotence** : `offline_uuid` est unique par espace. Un renvoi renvoie l'opération déjà enregistrée.
- **ADR-005, référence définitive** : elle est attribuée par le serveur. La référence provisoire `HL-N` reste sur l'appareil.
- **ADR-005 et P2, conflits** :
  - une vente faite hors ligne est enregistrée au prix connu de l'appareil, même s'il a changé ;
  - si le stock a baissé entre-temps, il descend à 0 et jamais en dessous (lecture sous verrou) ;
  - la vente est alors marquée « à vérifier » avec le motif (« Faites un inventaire »), jamais perdue ;
  - le filtre `filter[sync_status]=to_review` de « Mes ventes » la retrouve.
- **Pas de GeniusPay hors ligne** : un paiement de crédit qui n'est pas en espèces est refusé. Une vente payée par un mode GeniusPay est refusée quand GeniusPay est actif dans l'espace ; la caisse masque déjà ces modes sans réseau.
- **Heure de l'opération** : celle de l'appareil est gardée. Une horloge en avance est ramenée à l'heure de réception, pour qu'une dépense ne soit pas refusée comme « dans le futur ».
- **§6.2** : les droits sont ceux de l'utilisateur **au moment de l'envoi**. Un droit retiré pendant la coupure donne un refus clair.
- **M00, suspension** : un espace en lecture seule refuse l'envoi (402). Les opérations restent sur l'appareil jusqu'au paiement de l'abonnement.

## Décisions prises pendant la phase

- **Une opération à la fois**, chacune dans sa propre transaction, dans l'ordre d'envoi : un refus ne bloque pas le reste. Une panne inattendue (erreur non métier) fait échouer l'envoi entier, et l'appareil réessaiera.
- **Opération illisible** (type inconnu, `offline_uuid` qui n'est pas un UUID) : refusée avec un message, plutôt que d'interrompre l'envoi.
- **Limite de 200 opérations** par envoi, ce qui dépasse largement une journée de coupure d'une boutique. Au-delà, l'envoi est refusé (422) et l'appareil doit découper.

## Vérifications faites

- **89 tests passent** (845 assertions), dont 4 nouveaux :
  - lot mixte (vente, paiement de crédit, dépense) : références `V-1`, `RB-1`, `DP-1`, heure de l'appareil gardée, stock et solde du client justes ; le lot renvoyé ne donne que des `duplicate`, sans rien enregistrer deux fois ;
  - conflit : la vente faite hors ligne au prix de l'appareil (1 200 au lieu de 1 500) et pour 3 articles alors qu'il n'en reste que 2 est enregistrée « à vérifier », avec les deux motifs ; le stock finit à 0 et le filtre « à vérifier » la retrouve ;
  - refus sans bloquer les autres : paiement de crédit en Mobile Money, vente GeniusPay, client désactivé, opération illisible, droit retiré ; la dernière vente du lot est bien enregistrée ;
  - horloge en avance, droits, boutique non affectée, limite de 200, espace suspendu (402).
- **Navigateur** (frontend en `dev:api`, réseau coupé par Playwright) :
  - sans réseau, une dépense de 1 500 FCFA et une vente de 2 spaghettis, enregistrées sur l'appareil (`HL-1`, `HL-2`) ;
  - au retour du réseau, envoi automatique ; le serveur répond `created` pour les deux, avec `DP-14` et `V-278` ;
  - l'écran « Synchronisation » affiche « Vente V-278 » et « Dépense DP-14 », envoyées.

  Seule erreur relevée : le 401 attendu sur `/me` avant la connexion.
- `vendor/bin/pint --test` passe.

## Pièges rencontrés

- **Tester le hors ligne en développement** : il n'y a pas de service worker. Un écran ne s'ouvre sans réseau que si son code a déjà été chargé dans la session, et ses listes (catégories, modes de paiement) ne s'affichent que si elles ont déjà été lues avec le réseau. En production, le service worker garde le code de l'application. Pour un test réaliste, utiliser le build (`npx vite build` puis `npx vite preview`).

## Limites

- **Opérations « à vérifier »** : le serveur les marque, mais aucun écran ne permet encore au gérant de les déclarer vérifiées. La vente reste « à vérifier » dans l'historique.
- **Clients créés hors ligne** : non prévus. La caisse ne propose sans réseau que les clients déjà sur l'appareil, comme le prévoit le contrat F9.
- **Paiements GeniusPay** : la synchronisation n'en enregistre jamais ; le pilote réel reste à faire (voir [B8](B8-inscription-abonnement-api.md)).
