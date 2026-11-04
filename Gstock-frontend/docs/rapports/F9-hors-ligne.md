# F9 — Hors ligne (PWA, cache, synchronisation)

> **Statut : terminée** (branche `front-hors-ligne`).
> Livrable du cahier (§11.4) : « Vente sans réseau ». ADR-005, M08 (mode hors ligne), §12.4, P2.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `1d9ec23` | **Synchronisation simulée** `POST /shops/{id}/sync` (`src/mocks/handlers/sync.ts`) : idempotente par `offline_uuid`, ventes avec écart enregistrées « à vérifier », refus expliqués ; `sync_status` et `review_reasons` sur les ventes ; clients, soldes et taux de taxe dans `pos/bootstrap` ; serveur injoignable quand l'appareil n'a pas de réseau. |
| `1d7858a` | **Application** : service worker et manifeste (installable), cache IndexedDB des réponses, file des opérations hors ligne, synchronisation automatique, caisse, paiements en espèces et dépenses sans réseau, indicateur, bandeau, page « Synchronisation », badge « À vérifier » dans « Mes ventes ». |

## Écrans et comportements

| Où | Ce qui change sans réseau | Accès |
|---|---|---|
| Partout | Bandeau « Pas de réseau : vous pouvez continuer à vendre… » ; indicateur « Hors ligne · 2 à envoyer · 1 à vérifier » (en-tête mobile, menu latéral, caisse) qui mène à la synchronisation. Les pages déjà ouvertes s'affichent depuis le cache ; une page jamais ouverte affiche « Pas de réseau » au lieu de charger sans fin. | tous |
| `/vendre` | Total **provisoire** calculé sur l'appareil (affiché comme tel) ; espèces, paiement partiel et crédit possibles ; GeniusPay et l'avoir masqués ; clients pris dans le cache de la caisse (pas de création) ; fin de vente avec référence provisoire `HL-N` et rendu monnaie ; le stock du cache diminue. | `sales.create` |
| Paiement de crédit | Espèces seulement, gardé sur l'appareil. | `repayments.create` |
| Dépense | Gardée sur l'appareil. | `expenses.create` |
| `/synchronisation` | À vérifier (écart ou refus, avec la raison), à envoyer, envoyées (numéro définitif, lien vers l'opération) ; « Envoyer maintenant », « J'ai vérifié », « Retirer de l'appareil » (refusées seulement). | chacun ses opérations |
| `/ventes` | Badge et filtre « À vérifier » ; le détail liste les écarts. | `sales.view` |
| Menu du compte | « Installer l'application » quand le navigateur le propose ; avertissement à la déconnexion s'il reste des opérations à envoyer. | tous |

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/sw/sw.ts`, `vite.config.ts` | Service worker (Workbox, `injectManifest`) : précache de l'application, `index.html` pour toutes les adresses. Avec les mocks, il charge aussi le worker de MSW (seulement pour `/api/` et `/sanctum/`), car deux service workers ne peuvent pas contrôler la même page. |
| `src/offline/network.ts` | En ligne = réseau du navigateur **et** serveur qui répond (`client.ts` signale chaque réponse ou échec). |
| `src/offline/persister.ts`, `storage.ts` | Cache des requêtes TanStack Query dans IndexedDB (7 jours), relu au démarrage quand le réseau est là. |
| `src/offline/queue.ts`, `send.ts`, `sync.ts`, `hooks.ts` | File persistée dans IndexedDB, envoi ou mise en file (`sendOrKeep`), synchronisation automatique (démarrage, retour du réseau, toutes les 30 s). |
| `src/offline/quote.ts` | Calcul provisoire de la caisse, mêmes règles que `/sales/quote`. |
| `src/features/sync/` | Indicateur, bandeau, page de synchronisation. |
| `src/mocks/handlers/sync.ts`, `src/mocks/sales.ts` | Synchronisation serveur ; mode `offline` de `recordSale`. |

## Endpoints

Prévus par le cahier : `GET /shops/{id}/pos/bootstrap`, `POST /shops/{id}/sync`.

Précisions à reporter dans le cahier :
- `POST /shops/{id}/sync {operations: [{type: sale|repayment|expense, offline_uuid, occurred_at, payload}]}` → un résultat par opération : `created`, `duplicate`, `to_review` (avec `reasons`) ou `rejected` (avec `message`) ; la référence définitive est dans `resource`.
- `pos/bootstrap` renvoie aussi `customers` (soldes et avoirs dans la boutique), `tax_rate` par produit et `generated_at`.
- Ventes : `sync_status` (`ok`, `to_review`), `review_reasons`, filtre `filter[sync_status]`.

## Règles appliquées

- **Idempotence** : le même `offline_uuid` sert à l'envoi direct et à la file ; un second envoi renvoie `duplicate`, jamais une deuxième opération. Une coupure pendant l'envoi remet l'opération dans la file.
- **Référence définitive** attribuée par le serveur à la synchronisation ; `HL-N` sur l'appareil en attendant.
- **Pas de GeniusPay hors ligne** : masqué à la caisse ; un paiement de crédit non espèces est refusé à la synchronisation.
- **Conflits (P2)** : une vente dont le stock a baissé entre-temps est **enregistrée** et marquée « à vérifier », le stock descend à 0 au plus (**jamais négatif**, toujours égal à la somme des mouvements). Une vente faite au prix connu de l'appareil garde ce prix ; l'écart avec le prix actuel est signalé. Ce qui ne peut pas être enregistré (droit retiré, client supprimé, catégorie inconnue) reste sur l'appareil avec la raison : rien n'est perdu sans le dire.
- **Montants** recalculés par le serveur à la synchronisation ; le calcul de l'appareil est toujours affiché comme provisoire.
- Les opérations sont envoyées avec la session de leur auteur seulement.

## Décisions prises pendant la phase

| Sujet | Décision |
|---|---|
| Cache | Les réponses de l'API déjà reçues, gardées 7 jours dans IndexedDB (TanStack Query persisté), plutôt qu'un second modèle de données local. |
| Écritures sans réseau | Seules ventes, paiements en espèces et dépenses (ADR-005) ; les autres actions échouent tout de suite avec « Impossible de joindre le serveur ». |
| Prix hors ligne | Le prix de l'appareil est accepté puis signalé (le client a payé ce prix) ; à surveiller côté serveur, car un appareil pourrait envoyer un prix faux : il apparaîtra toujours « à vérifier ». |
| Données simulées | Sans réseau (`navigator.onLine` faux), les handlers répondent par une erreur réseau, comme un vrai serveur injoignable. |

## Vérifications faites

- **Navigateur (dev, réseau coupé par Playwright)** : vente espèces (rendu 5 100), vente à crédit avec un client du cache, dépense, trois opérations « en attente » ; retour du réseau → envoi automatique, références `V-283`, `V-284`, `DP-13` ; la vente d'huile préparée en conflit (3 vendues, 1 en stock) est « à vérifier » et le stock finit à 0.
- **Build avec service worker** : rechargement sans réseau → caisse ouverte avec ses 60 produits, vente enregistrée, file conservée après un second rechargement, page jamais ouverte → « Pas de réseau », puis envoi au retour du réseau.
- **Appels directs** : second envoi `duplicate` (une seule vente), paiement Mobile Money refusé, dépense invalide refusée avec le message précis, vendeur sans droit refusé, date métier conservée.
- Tous les scénarios de F1 à F8 repassent ; `typecheck`, `lint`, `build` sans erreur ; le service worker de production ne contient pas MSW.

## Limites

- En développement (`npm run dev`), le service worker de l'application n'est pas actif : la vente sans réseau marche, mais pas le rechargement sans réseau (le tester avec un build, voir le README).
- Pas de création de client ni d'utilisation de l'avoir sans réseau ; pas de reçu imprimable avant la synchronisation.
- Les écarts de solde client (deux appareils encaissant la même dette) aboutissent à un refus « à vérifier » sur l'appareil, sans transformation automatique en avoir.
- Pas de notification au gérant pour les opérations « à vérifier » (P2 la recommande) : elles sont visibles dans « Mes ventes » et sur l'appareil.
- Le cache n'est pas chiffré sur l'appareil ; il est vidé des données métier à la déconnexion.
