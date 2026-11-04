# GStock — État du projet

> Mis à jour le 4 novembre 2026, à la fin de la phase F6.
> Ce dossier est l'inventaire de ce qui a été **fait**. Il s'adresse à la personne (ou à l'agent) qui reprend le projet : ce fichier donne la vue d'ensemble et ce qui est commun à toutes les phases ; **chaque phase terminée a son rapport** (tableau ci-dessous) : ce qui a été livré, où se trouve le code, les règles appliquées, les vérifications faites et les limites.

## En bref

| | État |
|---|---|
| **Frontend** (`Gstock-frontend/`) | Phases **F1 à F6 terminées** sur 9 (§11.4 du cahier). Application navigable, entièrement sur données simulées (MSW). |
| **Backend** (`Gstock-plateform/`) | **Pas commencé.** Squelette Laravel 12 d'origine (SQLite, `routes/web.php`). Aucune ligne de code métier. |
| **Contrat d'API** | Défini côté frontend : types dans `src/types/`, endpoints dans `src/lib/api/`, comportement serveur reproduit dans `src/mocks/`. **C'est la spécification que le backend devra respecter** (ADR-004). Voir « Le contrat d'API pour le backend ». |
| **Phases restantes** | F7 à F9, décrites au §11.4 du cahier. Aucune n'est commencée. |

## Rapports des phases terminées

| Phase | Rapport | Branche |
|---|---|---|
| F1 — Socle | [F1-socle.md](F1-socle.md) | `front-socle` |
| F2 — Espace (paramètres, boutiques, utilisateurs, rôles, référentiels) | [F2-espace.md](F2-espace.md) | `front-espace` |
| F3 — Produits et stock | [F3-produits-stock.md](F3-produits-stock.md) | `front-produits` |
| F4 — Clients, caisse, ventes, reçus | [F4-clients-ventes.md](F4-clients-ventes.md) | `front-ventes` |
| F5 — Crédits clients | [F5-credits.md](F5-credits.md) | `front-credits` |
| F6 — Approvisionnements, fournisseurs, dépenses | [F6-approvisionnements-depenses.md](F6-approvisionnements-depenses.md) | `front-achats` |

Le **backend** (`Gstock-plateform/`) n'a pas de rapport : rien n'y a encore été fait.

**À la fin de chaque phase** : ajouter son rapport (`F7-….md`, etc.) sur le modèle des précédents, et mettre à jour ce sommaire et l'état dans `CLAUDE.md`.

Sources de vérité, à lire avant toute modification :

1. `docs/cahier-des-charges-gstock-final.md` : le cahier des charges (une copie identique est dans `Gstock-plateform/docs/` ; les deux doivent rester identiques).
2. `../CLAUDE.md` (racine du dépôt) : commandes, architecture, conventions, règles Git.
3. `design-system/gstock/MASTER.md` : le design system « Marché ».
4. Ces rapports.

## Démarrer en 2 minutes

```bash
cd Gstock-frontend
npm install
npm run dev          # http://localhost:5173, données simulées actives
```

- **Comptes de démonstration** : listés sur l'écran de connexion (un toucher pour se connecter). Mot de passe commun : `demo1234`.

  | Personne | Rôle | Boutiques | Sert à tester |
  |---|---|---|---|
  | Aminata Koné | Propriétaire (Owner) | toutes | tout, sélecteur de boutique, vue « Toutes mes boutiques » |
  | Ibrahim Traoré | Gérant | Cocody, Yopougon | presque tout sauf utilisateurs/rôles/abonnement |
  | Fatou Bamba | Vendeur | Cocody | une seule boutique (pas de sélecteur), lecture seule du stock, « ses propres ventes » |
  | Koffi N'Guessan | Caissier | Yopougon | vente sans droit de mettre à crédit |
  | Moussa Diallo | Gestionnaire de stock | Cocody, Yopougon | stock sans caisse |
  | Paul Yao | Vendeur, **désactivé** | Cocody | refus de connexion |

- **Remettre la démo à zéro** : bouton en bas de l'écran de connexion (les modifications sont gardées dans le `localStorage`, clé `gstock.mock.db.v6`).
- **Vitrine des composants** : `/vitrine` (développement uniquement).
- **Vérifications** : `npm run typecheck`, `npm run lint`, `npm run build`. Les trois passent sans erreur à la fin de F4.

## Historique Git

- Une branche par phase, fusionnée dans `main` sans pull request (`git merge --no-ff`, à la demande du propriétaire du projet) : `front-socle` (F1), `front-espace` (F2), `front-produits` (F3), `front-ventes` (F4).
- Règles (voir `CLAUDE.md`) : commits atomiques en français au format `type(portée): description` ; noms de branches courts mais explicites (`front-credits`, pas `f5`) ; jamais de mention de Claude comme co-auteur.

## Décisions prises en cours de route

Ces décisions complètent ou précisent le cahier. Celles marquées **[cahier]** y ont été reportées.

| Sujet | Décision |
|---|---|
| Stock négatif (P1) **[cahier]** | Interdit. Toute opération qui ferait passer `shop_stock.quantity` sous 0 est refusée (422, message en français). La caisse empêche d'ajouter plus que le stock. |
| Appels réseau **[cahier §11.2]** | Tous centralisés dans `src/lib/api/`. Seul `client.ts` appelle `fetch` ; oxlint l'interdit ailleurs (`fetch`, `window.fetch`, `globalThis.fetch`, `axios`). |
| Design | Direction « Marché » (blocs francs, contours 2 px, ombres décalées, police Outfit, indigo + mangue). Détail et interdits dans `MASTER.md`. La mangue (`action`) est réservée à **une** action principale par écran. |
| Nom du rôle Owner | Reste `Owner` dans le code et l'API ; l'interface affiche « Propriétaire » (`src/lib/roles.ts`). |
| Montants à la caisse | Le frontend ne calcule rien : il appelle **`POST /shops/{id}/sales/quote`** (ajout au contrat) à chaque changement du panier, et affiche le total renvoyé. |
| Quantités | Chaînes décimales à 3 décimales (`"12.000"`), en unité de base. Montants : chaînes à 2 décimales (`"4500.00"`), affichés sans décimales. |
| Référence d'un crédit issu d'une vente | Même référence que la vente (`V-N`). `CR-N` est réservé aux soldes initiaux. |
| Paniers en attente | Gardés **sur l'appareil** (Zustand persisté, clé `gstock.pos`), pas sur le serveur. Compatible avec le futur mode hors ligne ; un panier n'est donc pas partagé entre deux téléphones. |
| Annuler une vente déjà remboursée (P3) **[cahier]** | Décidé en F5 : le commerçant choisit de garder l'argent déjà reçu en **avoir** au nom du client (utilisable pour une dette ou un achat) ou de le **rendre** (sortie d'argent). |
| Produits à variantes | Reportés : seuls `simple` et `service` sont gérés (le formulaire l'annonce en mode avancé). |
| Mode avancé | Exposé dans `GET /me` (`tenant.advanced_mode`) pour que chaque écran sache quoi masquer. |
| Déconnexion | Mène toujours à l'accueil de la personne suivante (pas à la dernière page de la précédente). Nécessite `RouterProvider` importé de `react-router/dom` (voir « Pièges déjà rencontrés »). |

## Le contrat d'API pour le backend

Le backend devra reproduire ce que font les handlers de `src/mocks/handlers/` (un fichier par module). Points à connaître :

- **Conventions** (§9) respectées : préfixe `/api/v1`, snake_case, listes `{data, meta}`, paramètres `page`, `per_page`, `search`, `sort`, `filter[x]`, erreurs `{message, errors}` en français, 401/403/404/409/422.
- **Ajouts au cahier**, à valider puis reporter dans le §10 :
  - `POST /shops/{id}/sales/quote` (calcul des montants sans enregistrer) ;
  - `GET /stock` (vue « Toutes mes boutiques ») ;
  - `GET /shops/{id}/adjustments/{id}` (détail d'un mouvement manuel) ;
  - `GET /public/receipts/{token}` (reçu public du lien partagé) ;
  - `DELETE /roles/{id}` ;
  - paramètres `?shop_id=` sur `/products`, `?services=` sur la recherche produits ;
  - champs `summary` dans les listes de stock et de ventes ; `plan` dans `GET /settings` ; `tenant.advanced_mode` dans `GET /me`.
  - F5 : `GET /shops/{id}/credits`, `GET /shops/{id}/repayments` et `/{id}`, `POST /shops/{id}/repayments/{id}/share-link`, `refund_mode` et `refund_payment_method_id` sur les annulations (P3), paiement par avoir (`payment_method_id: null`, `credit_note: true`), `credit_note_balance` sur le client. Détail dans [F5-credits.md](F5-credits.md).
  - F6 : `POST /shops/{id}/purchases/quote`, `paid_amount` / `payment_method_id` / `update_costs` à la création d'un approvisionnement, `summary` des listes d'approvisionnements et de dépenses, totaux et filtre `has_due` des fournisseurs. Détail dans [F6-approvisionnements-depenses.md](F6-approvisionnements-depenses.md).
- **Où trouver les règles serveur déjà écrites** : `src/mocks/http.ts` (garde de session, permissions, validation, pagination), `src/mocks/stock.ts` (stock), `src/mocks/sales.ts` (ventes), `src/mocks/credits.ts` (crédits, remboursements, échéances, avoirs), `src/mocks/purchases.ts` (approvisionnements, dépenses). Elles sont commentées avec les paragraphes du cahier.

## Comment le frontend est organisé

```
src/
├── app/          routeur (pages chargées à la demande), mises en page, navigation
├── components/   composants partagés (DataList, FormField, ResponsiveSheet, Money, CancelDialog…)
│   └── ui/       composants shadcn rhabillés « Marché » (ne pas écraser button.tsx)
├── features/     un dossier par module : pages/, components/, hooks.ts, schemas.ts
├── lib/          api/ (seule couche réseau), format, i18n, query-client, hooks utilitaires
├── locales/fr/   un JSON de textes par module, réunis dans lib/i18n.ts (clés typées)
├── mocks/        MSW : data/ (jeux de démo), handlers/ (endpoints), db.ts, http.ts, stock.ts, sales.ts
└── types/        contrat d'API, un fichier par module
```

Recettes pour une nouvelle rubrique (c'est ainsi que F2 à F4 ont été faites) :

1. Lire la section du cahier (§7, §8, §10).
2. Écrire les types dans `src/types/<module>.ts`.
3. Écrire les fonctions d'appel dans `src/lib/api/<module>.ts`.
4. Écrire les handlers MSW dans `src/mocks/handlers/<module>.ts` avec les mêmes règles que le serveur (permissions, validation 422 en français, accès boutique via `requireShopAccess`), et les ajouter à `handlers/index.ts`. Si la forme de la base simulée change, incrémenter la clé dans `src/mocks/db.ts`.
5. Écrire les textes dans `src/locales/fr/<module>.json` et les ajouter à `src/lib/i18n.ts`. Pluriels : suffixes `_one` / `_other`.
6. Écrire les hooks TanStack Query dans `features/<module>/hooks.ts` : **la clé de cache des données de boutique contient l'id de la boutique**.
7. Écrire les pages avec les composants partagés ; chaque écran gère chargement, erreur, vide et succès.
8. Retirer `phase` de la rubrique dans `navigation.ts` et ajouter les routes (`lazy`) dans `router.tsx`.
9. Vérifier : `npm run typecheck && npm run lint && npm run build`, puis tester dans le navigateur en mobile et en desktop, avec plusieurs profils.

## Pièges déjà rencontrés

- **`RouterProvider` doit venir de `react-router/dom`**, pas de `react-router` : sinon l'option `flushSync` de `navigate()` est ignorée (cela cassait la déconnexion).
- **`npx shadcn add`** propose d'écraser `src/components/ui/button.tsx`, qui est personnalisé : refuser. Il importe aussi `cn` depuis le paquet `cn` : remplacer par `@/lib/utils`. Ensuite, rhabiller le composant selon `MASTER.md`.
- **Panneaux (`Sheet`)** : les classes de largeur de shadcn sont préfixées `data-[side=right]:` ; une classe simple ne les écrase pas (utiliser le même préfixe, voir `ResponsiveSheet.tsx`). Ne pas centrer un panneau avec `translate` : l'animation l'écrase.
- **Données de démo** : tout passe par les moteurs (`recordSale`, `applyStockChanges`) pour rester cohérent ; ne pas écrire directement dans `db.shopStock`.
- **Lint** : `react/only-export-components` impose un seul type d'export par fichier de composants (mettre schémas et constantes dans `schemas.ts`).
- **Versions récentes** : TypeScript 7, React Router 8, MSW 3, Tailwind 4, Zod 4, i18next 26. Vérifier les API dans `node_modules` plutôt que de se fier à des exemples anciens (MSW 3 : `onUnhandledFrame` au lieu de `onUnhandledRequest`).

## Tests

- **Aucun test automatisé dans le dépôt** (§12.6 du cahier le demandera).
- Chaque phase a été vérifiée dans un vrai navigateur (Chrome piloté par Playwright) avec des scénarios couvrant les règles ci-dessus : permissions par profil, validations, stock jamais négatif et égal à la somme des mouvements, crédit créé, idempotence, annulations, reçus. Ces scénarios ont été écrits hors du dépôt ; ils pourraient être repris comme base de tests de bout en bout (Playwright + MSW).

## Points ouverts du cahier

Encore à trancher (§17) : P2 (conflits hors ligne), P6 (facture normalisée DGI), P7 (plans tarifaires), P8 (validation des ADR), P9 (nom de domaine), P10 (reprise de données), P11 (transfert du propriétaire).
