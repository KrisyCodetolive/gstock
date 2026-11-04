# GStock — État du projet

> Mis à jour le 4 novembre 2026, à la fin de la phase B7 (tableau de bord et journal d'activité du backend).
> Ce dossier est l'inventaire de ce qui a été **fait**. Il s'adresse à la personne (ou à l'agent) qui reprend le projet : ce fichier donne la vue d'ensemble et ce qui est commun à toutes les phases ; **chaque phase terminée a son rapport** (tableau ci-dessous) : ce qui a été livré, où se trouve le code, les règles appliquées, les vérifications faites et les limites.

## En bref

| | État |
|---|---|
| **Frontend** (`Gstock-frontend/`) | **Toutes les phases F1 à F9 terminées** (§11.4 du cahier), plus F10 (compléments de la V1 relevés par la [comparaison avec l'ancien GStock](comparaison-ancien-gstock.md)). Application navigable, entièrement sur données simulées (MSW). |
| **Backend** (`Gstock-plateform/`) | **Socle (B1), référentiels (B2), produits et stock (B3), clients et ventes (B4), crédits clients (B5), approvisionnements et dépenses (B6), tableau de bord et journal (B7) livrés** : PostgreSQL en Docker, `/api/v1`, multi-tenant par sous-domaine, Sanctum, permissions, rôles, utilisateurs, boutiques, paramètres, audit, référentiels, catalogue, stock jamais négatif et égal à la somme des mouvements, caisse et ventes calculées par le serveur, paiements de crédit répartis, avoirs et échéanciers, approvisionnements convertis en unité de base, dettes fournisseurs, dépenses, tableau de bord selon la distinction financière du §7.8 ; 77 tests. Le frontend s'y branche avec `npm run dev:api`. Modules métier à venir. Voir [B1-socle-api.md](B1-socle-api.md). |
| **Contrat d'API** | Défini côté frontend : types dans `src/types/`, endpoints dans `src/lib/api/`, comportement serveur reproduit dans `src/mocks/`. **C'est la spécification que le backend devra respecter** (ADR-004). Voir « Le contrat d'API pour le backend ». |
| **Phases restantes** | Backend : inscription, assistant de démarrage et abonnement (avec GeniusPay), synchronisation hors ligne, back-office Filament (§15). Tous les modules métier du commerçant ont leur backend. |

## Rapports des phases terminées

| Phase | Rapport | Branche |
|---|---|---|
| F1 — Socle | [F1-socle.md](F1-socle.md) | `front-socle` |
| F2 — Espace (paramètres, boutiques, utilisateurs, rôles, référentiels) | [F2-espace.md](F2-espace.md) | `front-espace` |
| F3 — Produits et stock | [F3-produits-stock.md](F3-produits-stock.md) | `front-produits` |
| F4 — Clients, caisse, ventes, reçus | [F4-clients-ventes.md](F4-clients-ventes.md) | `front-ventes` |
| F5 — Crédits clients | [F5-credits.md](F5-credits.md) | `front-credits` |
| F6 — Approvisionnements, fournisseurs, dépenses | [F6-approvisionnements-depenses.md](F6-approvisionnements-depenses.md) | `front-achats` |
| F7 — Tableau de bord et journal d'activité | [F7-tableau-de-bord-audit.md](F7-tableau-de-bord-audit.md) | `front-tableau-de-bord` |
| F8 — Inscription, assistant de démarrage, abonnement | [F8-inscription-abonnement.md](F8-inscription-abonnement.md) | `front-inscription` |
| F9 — Hors ligne (PWA, cache, synchronisation) | [F9-hors-ligne.md](F9-hors-ligne.md) | `front-hors-ligne` |
| F10 — Compléments de la V1 (mot de passe oublié, profil, photos, scan caméra, unité d'achat, échéancier fournisseurs, variantes) | [F10-complements-v1.md](F10-complements-v1.md) | `front-complements-v1` |

| B1 — Socle du backend (Laravel, PostgreSQL, multi-tenant, identité et accès, boutiques, audit) | [B1-socle-api.md](B1-socle-api.md) | `api-socle` |
| B2 — Référentiels du backend (catégories, unités, modes de paiement, catégories de dépenses, marques) | [B2-referentiels-api.md](B2-referentiels-api.md) | `api-referentiels` |
| B3 — Produits et stock du backend (catalogue, variantes, registre de stock verrouillé, mouvements MS-N) | [B3-produits-stock-api.md](B3-produits-stock-api.md) | `api-produits-stock` |
| B4 — Clients, caisse et ventes du backend (calcul serveur, crédit automatique, annulation, reçus signés) | [B4-clients-ventes-api.md](B4-clients-ventes-api.md) | `api-clients-ventes` |
| B5 — Crédits clients du backend (paiements RB-N répartis, anciennes dettes CR-N, échéanciers, régularisations, avoirs et P3) | [B5-credits-api.md](B5-credits-api.md) | `api-credits` |
| B6 — Approvisionnements, fournisseurs et dépenses du backend (unité d'achat, entrée en stock, dettes fournisseurs et échéancier, dépenses) | [B6-achats-depenses-api.md](B6-achats-depenses-api.md) | `api-achats-depenses` |
| B7 — Tableau de bord et journal d'activité du backend (distinction financière §7.8, toutes boutiques, recherche par auteur) | [B7-tableau-de-bord-api.md](B7-tableau-de-bord-api.md) | `api-tableau-de-bord` |

Hors phase : [comparaison-ancien-gstock.md](comparaison-ancien-gstock.md) confronte l'inventaire de l'ancien GStock (Stocky v5.0) avec le nouveau, pour décider de ce qu'il faut reprendre.

Hors phase également, branche `demo-images-produits` : chaque produit de démonstration a une illustration SVG d'emballage dans le style « Marché » (`src/mocks/data/product-images.ts`, données simulées seulement, absentes du build de production ; base simulée v9), et les tuiles de la caisse sont plus compactes (3 colonnes sur mobile, 5 sur grand écran).

Les phases du backend sont notées `B<n>` (B1 = socle) ; leurs rapports sont dans ce même dossier.

**À la fin de chaque phase** : ajouter son rapport sur le même modèle sur le modèle des précédents, et mettre à jour ce sommaire et l'état dans `CLAUDE.md`.

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

- **Remettre la démo à zéro** : bouton en bas de l'écran de connexion. Il efface tout le `localStorage` simulé : plateforme (`gstock.mock.platform.v1`), une base par espace (`gstock.mock.db.v9.<slug>`), sessions.
- **Créer un espace** : « Créer mon espace » sur l'écran de connexion (`/inscription`). L'écran de connexion permet ensuite de passer d'un espace à l'autre (démo seulement). Dans « Mon abonnement », des outils de simulation font avancer le temps (fin d'essai, impayé, suspension).
- **Tester le hors ligne** : en dev, couper le réseau (outils du navigateur) suffit pour vendre sans réseau. Pour le rechargement sans réseau, il faut le service worker : `VITE_USE_MOCKS=true npx vite build --outDir dist-mock && npx vite preview --outDir dist-mock`.
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
| Produits à variantes | Livrés en F10 (mode avancé) : stock, prix et code-barres par variante. Dans les lignes renvoyées par l'API, `product.name` contient le nom de la variante (« Jus de fruits 1 L — Bissap ») et `variant` la précise ; côté écran, un article se repère par `articleKey(productId, variantId)`. Le type « à variantes » ne change plus après la création. |
| Mot de passe oublié | Par e-mail seulement (F10) ; avec un compte au téléphone, le propriétaire change le mot de passe. `demo_reset_url` n'existe que dans les données simulées. |
| Photos | Réduites sur l'appareil avant l'envoi (`src/lib/image.ts`), envoyées en multipart par `http.upload`. |
| Unités d'achat | Unité choisie par ligne d'approvisionnement, convertie par le serveur ; le prix d'achat du produit reste par unité de base (F10). |
| Mode avancé | Exposé dans `GET /me` (`tenant.advanced_mode`) pour que chaque écran sache quoi masquer. |
| Plans (P7) | Hypothèse en attendant l'équipe produit : Essentiel 5 000, Commerce 12 000, Réseau 25 000 FCFA/mois ; essai 14 jours ; grâce 7 jours. Voir [F8](F8-inscription-abonnement.md). |
| Espace suspendu | Lecture seule (écritures refusées en **402**), connexion permise ; seule la fermeture par Genius Groups bloque la connexion. |
| Hors ligne | Cache = réponses de l'API gardées 7 jours dans IndexedDB ; seules ventes, paiements en espèces et dépenses se font sans réseau ; une vente en conflit est enregistrée « à vérifier », stock jamais négatif. Voir [F9](F9-hors-ligne.md). |
| Avoir d'un client (backend) | Tenu en écritures signées dans `credit_notes` (création, usage, retour) ; le solde est leur somme. Voir [B5](B5-credits-api.md). |
| Échéanciers (backend) | Une seule table `installments` pour les crédits clients et les dettes fournisseurs (`payable_type`) ; statut calculé à la lecture. |
| Tableau de bord (backend) | Calculé à la demande en SQL agrégé (`app/Domain/Reporting/DashboardService.php`), sans table de statistiques ; fuseau `Africa/Abidjan`. Voir [B7](B7-tableau-de-bord-api.md). |
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
  - F7 : détail de la réponse du tableau de bord (`money_in.by_method`, `money_out`, `result.complete`, `recent`…), `GET /dashboard` réservé au propriétaire, filtres du journal (`filter[domain]`…). Détail dans [F7-tableau-de-bord-audit.md](F7-tableau-de-bord-audit.md).
  - F8 : `GET /register/check-slug`, `POST /auth/token-login` (lien à usage unique renvoyé par `/register`), `GET /onboarding` et ses actions, `tenant.subscription` dans `GET /me`, `usage` et `pending_invoice` dans `GET /subscription`, statut 402 en lecture seule, `max_products`. Détail dans [F8-inscription-abonnement.md](F8-inscription-abonnement.md).
  - F9 : résultats de `POST /shops/{id}/sync` (`created`, `duplicate`, `to_review`, `rejected`), `customers` et `tax_rate` dans `pos/bootstrap`, `sync_status` et `review_reasons` sur les ventes. Détail dans [F9-hors-ligne.md](F9-hors-ligne.md).
  - F10 : `PUT /me/password`, `POST|DELETE /me/avatar`, `POST|DELETE /products/{id}/image`, `PUT /shops/{id}/purchases/{id}/installments` (avec `installments` et `overdue_amount`), `purchase_unit_id` / `purchase_unit` / `units` sur le produit, `unit_id` / `unit` / `base_quantity` sur les lignes d'approvisionnement, `variants` sur le produit et `variant_id` / `variant` sur toutes les lignes (vente, approvisionnement, mouvement de stock). Détail dans [F10-complements-v1.md](F10-complements-v1.md).
- **Où trouver les règles serveur déjà écrites** : `src/mocks/http.ts` (garde de session, permissions, validation, pagination), `src/mocks/stock.ts` (stock), `src/mocks/sales.ts` (ventes), `src/mocks/credits.ts` (crédits, remboursements, échéances, avoirs), `src/mocks/purchases.ts` (approvisionnements, dépenses), `src/mocks/handlers/dashboard.ts` (tableau de bord §7.8), `src/mocks/audit.ts` (journal), `src/mocks/platform.ts` et `handlers/platform.ts` (inscription, abonnement, webhook GeniusPay, lecture seule), `handlers/sync.ts` (synchronisation hors ligne). Elles sont commentées avec les paragraphes du cahier.

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
- **Dates de démo** : toujours relatives au jour de génération (`src/mocks/data/dates.ts`) ; ne jamais écrire de date fixe dans les jeux de démonstration.
- **Service worker et MSW** : deux service workers ne peuvent pas contrôler la même page. En build, `src/sw/sw.ts` charge le worker de MSW (mocks seulement) ; en dev, seul `mockServiceWorker.js` tourne. Le cache IndexedDB est relu au démarrage (`invalidateQueries`), sinon des données d'une session précédente restent affichées.
- **Plusieurs espaces simulés** : `db` est la base de l'espace ouvert ; changer d'espace passe par `openTenantDb()` (jamais une réaffectation de `db`, importé partout). Les scripts de test qui lisent le `localStorage` doivent utiliser les clés par espace.
- **Données de démo** : tout passe par les moteurs (`recordSale`, `applyStockChanges`) pour rester cohérent ; ne pas écrire directement dans `db.shopStock`.
- **Lint** : `react/only-export-components` impose un seul type d'export par fichier de composants (mettre schémas et constantes dans `schemas.ts`).
- **Variantes et clés React** : plusieurs lignes peuvent porter le même `product.id` (une par variante). Toute liste de lignes ou d'articles se clé avec `articleKey(product.id, variant?.id)`, sinon React mélange les lignes.
- **Codes-barres de démonstration** : ce sont de vrais EAN-13. La clé de contrôle est calculée (`ean13()` dans `src/mocks/data/products.ts`) : un code à la clé fausse n'est lu ni par la caméra ni par une douchette. Un nouveau code ne doit pas reprendre les 12 premiers chiffres d'un code existant.
- **Fichiers envoyés** : passer par `http.upload(path, formData)`, jamais par `http.post` (qui encode en JSON).
- **Backend, tests et Sanctum** : en test, l'application n'est pas recréée entre deux requêtes. `actingAs()` avec la garde de session perd l'utilisateur à la requête suivante : utiliser `Sanctum::actingAs()`, et `forgetGuards()` après une déconnexion (voir `tests/TestCase.php`).
- **Backend, espaces en développement** : l'espace est le sous-domaine de `localhost` (`alimentation-kone.localhost:5173`). Le proxy Vite garde le Host (`changeOrigin: false`), sinon le serveur ne reconnaît pas l'espace. `SANCTUM_STATEFUL_DOMAINS=*.localhost,*.localhost:*` accepte tous les ports.
- **Backend, recherche** : les listes cherchent sans accents grâce à l'extension PostgreSQL `unaccent` (créée par la première migration).
- **Backend, stock** : ne jamais écrire dans `shop_stock` directement. Passer par `StockLedger::apply()` (mouvements + verrous) ; la base refuse de toute façon une quantité négative (`CHECK`).
- **Backend, fonctions fléchées PHP** : `fn () => $x` capture `$x` par valeur au moment de sa création. Pour une variable remplie plus tard (ex. présentateur créé par `beforeMap`), utiliser `function () use (&$x)`.
- **Backend, soldes des crédits** : ne jamais écrire `remaining_amount` à la main. Passer par `CreditLedger::recompute()` après chaque paiement, régularisation ou annulation ; les paiements `pending` (GeniusPay) ne comptent pas.
- **Backend, horloge** : toujours `now()` (Carbon) et jamais `time()`, sinon `travel()` dans les tests n'a pas d'effet (cas rencontré sur l'expiration des liens de reçu).
- **Versions récentes** : TypeScript 7, React Router 8, MSW 3, Tailwind 4, Zod 4, i18next 26. Vérifier les API dans `node_modules` plutôt que de se fier à des exemples anciens (MSW 3 : `onUnhandledFrame` au lieu de `onUnhandledRequest`).

## Tests

- **Aucun test automatisé dans le dépôt** (§12.6 du cahier le demandera).
- Chaque phase a été vérifiée dans un vrai navigateur (Chrome piloté par Playwright) avec des scénarios couvrant les règles ci-dessus : permissions par profil, validations, stock jamais négatif et égal à la somme des mouvements, crédit créé, idempotence, annulations, reçus. Ces scénarios ont été écrits hors du dépôt ; ils pourraient être repris comme base de tests de bout en bout (Playwright + MSW).

## Points ouverts du cahier

Encore à trancher (§17) : P2 (conflits hors ligne), P6 (facture normalisée DGI), P7 (plans tarifaires), P8 (validation des ADR), P9 (nom de domaine), P10 (reprise de données), P11 (transfert du propriétaire).
