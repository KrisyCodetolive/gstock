# F9 — Hors ligne (PWA)

> **Statut : à faire.** Branche suggérée : `front-hors-ligne`.
> Livrable du cahier (§11.4) : « Vente sans réseau ». ADR-005, §12.4, point ouvert P2.

## Périmètre

- Application **installable** (vite-plugin-pwa, pas encore installé).
- **Cache local** (IndexedDB) de la boutique courante : produits, prix, stock, clients et soldes.
- **Opérations possibles hors ligne** : ventes (y compris à crédit), remboursements en espèces, dépenses.
- **Indicateur de connexion**, **file des opérations à synchroniser**, synchronisation automatique au retour du réseau, liste des opérations « à vérifier ».
- Endpoint de synchronisation prévu : `POST /shops/{id}/sync`.
- Critères : une vente hors ligne apparaît **une seule fois** après synchronisation même si l'envoi est répété ; la caisse reste utilisable après rechargement de la page sans réseau.

## Règles

- Chaque opération porte un `offline_uuid` généré par l'appareil ; le serveur ne l'enregistre jamais deux fois.
- La **référence définitive** (`V-N`, `RB-N`, `DP-N`) est attribuée par le serveur ; l'appareil affiche une référence provisoire.
- **Pas de paiement GeniusPay hors ligne.**
- Conflits (stock insuffisant, client modifié ailleurs) : l'opération est **enregistrée et marquée « à vérifier »**, jamais perdue (P2 : notifier le gérant).
- Soldes et stock recalculés par le serveur après synchronisation.

## Ce qui est déjà préparé

- **`offline_uuid`** déjà envoyé par la caisse (`CheckoutSheet.tsx`) et les mouvements de stock (`AdjustmentFormPage.tsx`) ; le serveur simulé est déjà idempotent pour ces deux endpoints.
- **`GET /shops/{id}/pos/bootstrap`** renvoie déjà tout ce que la caisse doit mettre en cache (produits, prix, stock, catégories, modes de paiement) ; il manque les clients et leurs soldes.
- **Panier et paniers en attente** déjà gardés sur l'appareil (`src/features/pos/store.ts`).
- Dossier prévu par le cahier : `src/offline/` (pas encore créé).

## Difficulté à anticiper

Hors ligne, la caisse ne peut pas appeler `POST /sales/quote` : il faudra un calcul local **provisoire** des totaux (mêmes règles que §7.4, voir `computeSale` dans `src/mocks/sales.ts`), clairement présenté comme provisoire, le serveur recalculant à la synchronisation.
