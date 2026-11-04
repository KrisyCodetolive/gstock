# GStock — État du projet

> Mis à jour le 4 novembre 2026, à la fin de la phase F4.
> Ce rapport s'adresse à la personne (ou à l'agent) qui reprend le projet. Il dit ce qui est fait, où se trouve le code, ce qui a été décidé en chemin, ce qui manque, et comment continuer.

## 1. En bref

| | État |
|---|---|
| **Frontend** (`Gstock-frontend/`) | Phases **F1 à F4 terminées** sur 9 (§11.4 du cahier). Application navigable, entièrement sur données simulées (MSW). |
| **Backend** (`Gstock-plateform/`) | **Pas commencé.** Squelette Laravel 12 d'origine (SQLite, `routes/web.php`). Aucune ligne de code métier. |
| **Contrat d'API** | Défini côté frontend : types dans `src/types/`, endpoints dans `src/lib/api/`, comportement serveur reproduit dans `src/mocks/`. **C'est la spécification que le backend devra respecter** (ADR-004). Voir la section 6. |
| **Prochaine étape** | **F5 — Crédits clients** (remboursements, affectations, échéances). |

Sources de vérité, à lire avant toute modification :

1. `docs/cahier-des-charges-gstock-final.md` : le cahier des charges (une copie identique est dans `Gstock-plateform/docs/` ; les deux doivent rester identiques).
2. `../CLAUDE.md` (racine du dépôt) : commandes, architecture, conventions, règles Git.
3. `design-system/gstock/MASTER.md` : le design system « Marché ».
4. Ce rapport.

## 2. Démarrer en 2 minutes

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

- **Remettre la démo à zéro** : bouton en bas de l'écran de connexion (les modifications sont gardées dans le `localStorage`, clé `gstock.mock.db.v3`).
- **Vitrine des composants** : `/vitrine` (développement uniquement).
- **Vérifications** : `npm run typecheck`, `npm run lint`, `npm run build`. Les trois passent sans erreur à la fin de F4.

## 3. Historique Git

- Une branche par phase, fusionnée dans `main` sans pull request (`git merge --no-ff`, à la demande du propriétaire du projet) : `front-socle` (F1), `front-espace` (F2), `front-produits` (F3), `front-ventes` (F4).
- Règles (voir `CLAUDE.md`) : commits atomiques en français au format `type(portée): description` ; noms de branches courts mais explicites (`front-credits`, pas `f5`) ; jamais de mention de Claude comme co-auteur.
- Pour F5, créer la branche `front-credits` depuis `main`.

## 4. Décisions prises en cours de route

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
| Annuler une vente déjà remboursée (P3) | Encore ouvert dans le cahier. En attendant, le serveur simulé **refuse** (409) l'annulation d'une vente dont le crédit a reçu un remboursement. À trancher en F5. |
| Produits à variantes | Reportés : seuls `simple` et `service` sont gérés (le formulaire l'annonce en mode avancé). |
| Mode avancé | Exposé dans `GET /me` (`tenant.advanced_mode`) pour que chaque écran sache quoi masquer. |
| Déconnexion | Mène toujours à l'accueil de la personne suivante (pas à la dernière page de la précédente). Nécessite `RouterProvider` importé de `react-router/dom` (voir §8). |

## 5. Inventaire module par module

Pour chaque module : écrans (adresses), fichiers, endpoints utilisés, règles appliquées, limites connues. Les numéros Mxx renvoient au §10 du cahier.

### Socle (F1)

- **Écrans** : `/connexion`, `/` (accueil : actions rapides selon les permissions), barre basse mobile (Accueil, Stock, **Vendre** au centre, Crédits, Plus), barre latérale desktop, pages « accès refusé », « introuvable », « bientôt disponible ».
- **Fichiers** : `src/app/` (routeur, mises en page, navigation), `src/components/` (composants partagés), `src/features/auth/`, `src/features/shops/components/ShopSwitcher.tsx`, `src/lib/`.
- **Navigation** : une seule liste, `src/app/navigation.ts`. Une rubrique avec `phase` affiche « Bientôt disponible » ; **retirer `phase` quand la rubrique est livrée** et ajouter ses routes dans `src/app/router.tsx`.
- **Permissions** : `useCan()` (`features/auth/hooks.ts`) masque menus, cartes et boutons ; `RequirePermission` protège chaque route ; le serveur simulé refuse en 403 de son côté.
- **Sélecteur de boutique** (§3.6) : n'apparaît qu'avec au moins 2 boutiques. Panneau du bas sur mobile, liste déroulante sur desktop. Boutique courante gardée dans `src/lib/current-shop.ts`.
- **Endpoints** : `GET /sanctum/csrf-cookie`, `POST /auth/login` (champ `login` = e-mail ou téléphone), `POST /auth/logout`, `GET /me`.
- **Limites** : pas de « mot de passe oublié » ni de page profil (M02) ; pas de vrai Sanctum (le client envoie déjà `credentials: 'include'` et l'en-tête `X-XSRF-TOKEN`).

### M03 — Espace, boutiques, paramètres (F2)

- **Écrans** : `/parametres` (accueil des paramètres, rubriques selon permissions, liste dans `features/settings/sections.ts`), `/parametres/espace`, `/parametres/paiements-en-ligne`, `/parametres/boutiques`, `/parametres/boutiques/nouvelle`, `/parametres/boutiques/:id`.
- **Fichiers** : `src/features/settings/`, `src/features/shops/`, `src/lib/api/settings.ts`, `src/lib/api/shops.ts`.
- **Endpoints** : `GET|PUT /settings` (renvoie aussi `plan`), `GET|PUT /settings/payment`, `POST /settings/payment/test`, `GET|POST /shops`, `GET|PUT /shops/{id}`.
- **Règles** : clés GeniusPay jamais renvoyées en clair (seulement un indice `•••• abcd`) ; limite de 3 boutiques ouvertes (plan de démo) ; pas de suppression, on ferme/rouvre ; au moins une boutique ouverte ; une boutique fermée disparaît du sélecteur ; la création initialise le stock à 0 pour tous les produits. Fiche boutique : « Qui a accès à cette boutique ? ».
- **Limites** : pas d'envoi de logo ; « client par défaut » d'une boutique non proposé.

### M04 — Utilisateurs, rôles, permissions (F2)

- **Écrans** : `/parametres/roles`, `/parametres/roles/nouveau`, `/parametres/roles/:id`, `/parametres/utilisateurs`, `/parametres/utilisateurs/nouveau`, `/parametres/utilisateurs/:id`.
- **Fichiers** : `src/features/roles/` (grille `PermissionGrid`, exemples `examples.ts`), `src/features/users/`, `src/types/users.ts`, `src/types/auth.ts` (liste des 42 permissions du §6.3).
- **Endpoints** : `GET /permissions`, `GET|POST /roles`, `GET|PUT|DELETE /roles/{id}`, `GET|POST /users`, `GET|PUT /users/{id}`, `PATCH /users/{id}/status`, `PUT /users/{id}/shops`.
- **Règles** : Owner en lecture seule, ni modifiable ni supprimable, réservé au créateur ; un rôle attribué ne se supprime pas (409) ; un changement de permissions s'applique immédiatement ; un seul rôle par utilisateur ; connexion par e-mail **ou** téléphone (au moins un) ; e-mail et téléphone uniques ; le propriétaire ne peut pas être désactivé ; on ne se désactive pas soi-même ; un compte désactivé perd sa session.
- **Limites** : la création d'un utilisateur fait deux appels (`POST /users` puis `PUT /users/{id}/shops`), comme le prévoit le cahier ; si le second échoue, la personne existe sans boutique (corrigeable depuis sa fiche). Pas de journal d'audit (M14, phase F7).

### M05 — Référentiels (F2)

- **Écrans** : `/parametres/categories`, `/parametres/unites`, `/parametres/modes-de-paiement`, `/parametres/categories-de-depenses`, `/parametres/marques` (mode avancé). Tous sur un écran générique (`features/referentials/components/ReferentialPage.tsx`) avec formulaire en panneau.
- **Endpoints** : `GET|POST /{categories|units|payment-methods|expense-categories|brands}`, `PUT /…/{id}`. **Pas de DELETE** : on désactive.
- **Règles** : noms uniques ; une unité dérivée se rattache à une unité de base avec `*` ou `/` et une valeur (« 1 Carton = 12 Unité ») ; GeniusPay seulement pour Mobile Money et carte.

### M06 — Mes produits (F3)

- **Écrans** : `/produits` (recherche nom/code/code-barres, filtre catégorie, quantité et état dans la boutique courante), `/produits/nouveau` (création rapide : **nom et prix seuls obligatoires**, le reste replié), `/produits/:id` (fiche : modification, stock par boutique, derniers mouvements, désactivation).
- **Fichiers** : `src/features/products/` (dont `ProductPicker`, réutilisé par le stock et prévu pour d'autres écrans), `src/types/catalog.ts`, `src/lib/api/products.ts`.
- **Endpoints** : `GET /products?shop_id=` (ajoute le stock de la boutique), `GET|PUT /products/{id}`, `POST /products` (accepte `initial_quantity` + `shop_id`), `GET /products/{id}/stock`, `GET /shops/{id}/products/search?q=&services=`.
- **Règles** : code unique généré si vide (`P-0001`) ; code-barres unique ; un service n'a jamais de stock ; la création crée une ligne de stock à 0 dans chaque boutique ; la quantité initiale crée un mouvement « Stock initial » (permission `stock.entry`) ; désactiver demande `products.disable`.
- **Limites** : pas de variantes, pas d'envoi de photo (vignette = initiale sur la couleur de la catégorie), pas de scan par caméra (saisie et douchette OK).

### M07 — Mon stock (F3)

- **Écrans** : `/stock` (tuiles valeur / stock faible / rupture servant de filtres ; bascule « Toutes mes boutiques » pour le propriétaire), `/stock/entree`, `/stock/sortie`, `/stock/inventaire`, `/stock/mouvements?product_id=`, `/stock/operations/:id` (détail d'un `MS-N` et annulation).
- **Fichiers** : `src/features/stock/`, `src/types/stock.ts`, `src/lib/api/stock.ts`, **moteur** `src/mocks/stock.ts`.
- **Endpoints** : `GET /shops/{id}/stock` (avec `summary`), `GET /shops/{id}/stock/alerts`, `GET /stock` (vue toutes boutiques), `GET /shops/{id}/stock/movements`, `POST /shops/{id}/adjustments`, `GET /shops/{id}/adjustments/{id}`, `POST /shops/{id}/adjustments/{id}/cancel`.
- **Règles** : toute variation passe par `applyStockChanges()` qui vérifie **toutes** les lignes avant d'écrire (transaction) ; quantité = somme des mouvements ; jamais négatif ; références `MS-N` consommées seulement en cas de succès ; annulation avec motif obligatoire, mouvements inverses, refusée si elle rendrait le stock négatif ; `offline_uuid` idempotent ; sans `records.view_all`, on ne voit que ses mouvements.

### M10 — Mes clients (F4)

- **Écrans** : `/clients` (reste à payer, filtre « Doivent de l'argent »), `/clients/nouveau`, `/clients/:id` (reste à payer par boutique, achats, crédits, derniers achats, modification, désactivation).
- **Fichiers** : `src/features/customers/` (champs réutilisés par la création rapide de la caisse), `src/types/customers.ts`, `src/lib/api/customers.ts`.
- **Endpoints** : `GET|POST /customers` (filtres `has_balance`, `is_active`), `GET|PUT /customers/{id}`, `GET /customers/{id}/summary`.
- **Règles** : clients communs à l'espace, soldes calculés sur les boutiques visibles par l'utilisateur ; nom seul obligatoire ; téléphone unique.
- **Limites** : le bouton « Enregistrer un remboursement » mène à `/credits?client=…`, qui affiche encore « Bientôt disponible » (F5).

### M08 — Caisse et ventes (F4)

- **Écrans** : `/vendre` (caisse plein écran, hors mise en page habituelle), `/ventes` (historique), `/ventes/:id` (détail, annulation), `/ventes/:id/recu` (reçu, impression, WhatsApp), `/recu/:token` (reçu **public**, sans connexion).
- **Fichiers** : `src/features/pos/` (panier `store.ts`, total `hooks.ts`, encaissement `CheckoutSheet.tsx`), `src/features/sales/` (historique, détail, `ReceiptTicket.tsx`), `src/types/sales.ts`, `src/lib/api/sales.ts`, **moteur** `src/mocks/sales.ts`.
- **Endpoints** : `GET /shops/{id}/pos/bootstrap`, `POST /shops/{id}/sales/quote`, `POST /shops/{id}/sales`, `GET /shops/{id}/sales` (filtres `from`, `to`, `payment_status`, `user_id`, `customer_id` ; avec `summary`), `GET /shops/{id}/sales/{id}`, `POST /shops/{id}/sales/{id}/cancel`, `GET /shops/{id}/sales/{id}/receipt`, `POST /shops/{id}/sales/{id}/share-link`, `GET /public/receipts/{token}`.
- **Règles** (§7.1, §7.4, §7.5) : montants recalculés par le serveur (remise par ligne en `%` ou montant, remise globale, taxe exclusive en mode avancé) ; `crédit = total − payé` ; un reste exige un client et la permission `credits.create` ; crédit client créé automatiquement ; rendu sur les espèces uniquement, jamais compté comme argent reçu ; stock diminué dès la validation ; prix modifié ou remise seulement avec `sales.edit_price` / `sales.give_discount` ; annulation : motif, stock restitué, crédit annulé ; `offline_uuid` idempotent ; paiement GeniusPay « en attente » jusqu'au webhook (simulé : confirmé après 4 s) ; lien de reçu signé, valable 7 jours ; partage WhatsApp déclenché par le commerçant (`wa.me`), jamais automatique.
- **Performances mesurées** : ajout au panier 132 ms (< 200 ms exigés), vente en espèces de bout en bout en ~3 s.
- **Limites** : pas de mode hors ligne (F9) ; échec d'un paiement GeniusPay non géré ; pas de scan caméra ; brouillons non partagés entre appareils (voir §4).

### Rubriques encore « Bientôt disponible »

| Rubrique | Adresse | Phase |
|---|---|---|
| Mes crédits clients (M09) | `/credits` | F5 |
| Approvisionnements, Fournisseurs (M11) | `/approvisionnements`, `/fournisseurs` | F6 |
| Dépenses (M12) | `/depenses` | F6 |
| Tableau de bord (M13) | sur `/` (l'accueil actuel n'a que les actions rapides) | F7 |
| Journal d'activité (M14) | `/journal` | F7 |
| Inscription, assistant, abonnement (M00) | — | F8 |
| Hors ligne, PWA (ADR-005) | — | F9 |

## 6. Le contrat d'API pour le backend

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
- **Où trouver les règles serveur déjà écrites** : `src/mocks/http.ts` (garde de session, permissions, validation, pagination), `src/mocks/stock.ts` (stock), `src/mocks/sales.ts` (ventes, crédits). Elles sont commentées avec les paragraphes du cahier.

## 7. Comment le frontend est organisé

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

## 8. Pièges déjà rencontrés

- **`RouterProvider` doit venir de `react-router/dom`**, pas de `react-router` : sinon l'option `flushSync` de `navigate()` est ignorée (cela cassait la déconnexion).
- **`npx shadcn add`** propose d'écraser `src/components/ui/button.tsx`, qui est personnalisé : refuser. Il importe aussi `cn` depuis le paquet `cn` : remplacer par `@/lib/utils`. Ensuite, rhabiller le composant selon `MASTER.md`.
- **Panneaux (`Sheet`)** : les classes de largeur de shadcn sont préfixées `data-[side=right]:` ; une classe simple ne les écrase pas (utiliser le même préfixe, voir `ResponsiveSheet.tsx`). Ne pas centrer un panneau avec `translate` : l'animation l'écrase.
- **Données de démo** : tout passe par les moteurs (`recordSale`, `applyStockChanges`) pour rester cohérent ; ne pas écrire directement dans `db.shopStock`.
- **Lint** : `react/only-export-components` impose un seul type d'export par fichier de composants (mettre schémas et constantes dans `schemas.ts`).
- **Versions récentes** : TypeScript 7, React Router 8, MSW 3, Tailwind 4, Zod 4, i18next 26. Vérifier les API dans `node_modules` plutôt que de se fier à des exemples anciens (MSW 3 : `onUnhandledFrame` au lieu de `onUnhandledRequest`).

## 9. Tests

- **Aucun test automatisé dans le dépôt** (§12.6 du cahier le demandera).
- Chaque phase a été vérifiée dans un vrai navigateur (Chrome piloté par Playwright) avec des scénarios couvrant les règles ci-dessus : permissions par profil, validations, stock jamais négatif et égal à la somme des mouvements, crédit créé, idempotence, annulations, reçus. Ces scénarios ont été écrits hors du dépôt ; ils pourraient être repris comme base de tests de bout en bout (Playwright + MSW).

## 10. Suite du travail

1. **F5 — Mes crédits clients (M09)** : liste des crédits, remboursements `RB-N` (affectation du plus ancien au plus récent, modifiable, jamais au-delà du montant reçu), annulation de remboursement, solde initial `CR-N` (`credits.opening_balance`), échéances (§7.7), reçu de remboursement. Trancher P3 (avoir client) et adapter `cancelSale` dans `src/mocks/sales.ts`. Brancher le bouton « Enregistrer un remboursement » de la fiche client.
2. **F6** — Approvisionnements, fournisseurs, dépenses (M11, M12).
3. **F7** — Tableau de bord sur l'accueil (M13 : ventes du jour, argent reçu, stock faible, crédits, dépenses, résultat), journal d'activité (M14).
4. **F8** — Inscription, assistant de démarrage, abonnement (M00).
5. **F9** — PWA et hors ligne (ADR-005) : cache du `pos/bootstrap`, file de synchronisation avec `offline_uuid` (déjà envoyé par les formulaires de stock et la caisse).
6. **Backend** : à démarrer en suivant le contrat de la section 6 (PostgreSQL, stancl/tenancy, Sanctum, Filament, GeniusPay).
7. **Points ouverts du cahier** (§17) encore à trancher : P2 (conflits hors ligne), P3, P6 (facture normalisée DGI), P7 (plans tarifaires), P8 (validation des ADR), P9 (nom de domaine), P10, P11.
