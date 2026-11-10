# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

GStock : SaaS multi-tenant de gestion de stock, de point de vente (POS) et de crédits clients pour les petits commerces (Afrique de l'Ouest, FCFA, fuseau par défaut `Africa/Abidjan`). Éditeur : Genius Groups.

**La source de vérité est le cahier des charges** : `Gstock-plateform/docs/cahier-des-charges-gstock-final.md` (une copie identique se trouve dans `Gstock-frontend/docs/`. Si vous modifiez l'une, modifiez aussi l'autre). Il contient les ADR (§5), les permissions (§6.3), les règles de gestion (§7), le modèle de données (§8), les conventions d'API (§9) et le plan module par module M00–M14 (§10). Lisez la section concernée avant de coder un module.

## État actuel

L'inventaire de ce qui a été fait est dans `Gstock-frontend/docs/rapports/` : `README.md` en est le sommaire (vue d'ensemble, démarrage, décisions, contrat d'API, pièges), et il y a un rapport par phase terminée (`F1-socle.md` à `F9-hors-ligne.md`) avec ce qui a été livré, les fichiers, les endpoints, les règles appliquées et les limites. Lisez-les avant de reprendre le travail. Le rapport de chaque nouvelle phase est obligatoire : voir « Rapport de fin de phase ».

- `Gstock-frontend/` : **phases F1 à F10 livrées** (socle, espace, produits et stock, clients et ventes, crédits clients, approvisionnements et dépenses, tableau de bord et journal, inscription et abonnement, hors ligne, compléments de la V1). On y trouve TypeScript, React Router, TanStack Query, Tailwind v4 + shadcn/ui (base Radix, rhabillé « Marché »), React Hook Form + Zod, Zustand, MSW et react-i18next. F1 apporte la connexion simulée avec 5 profils, les permissions, le sélecteur de boutique et les mises en page mobile et desktop. F2 apporte les paramètres de l'espace, GeniusPay, les boutiques, les rôles, les utilisateurs et les référentiels, sous `/parametres`. F3 apporte « Mes produits » (création rapide, fiche avec stock par boutique) et « Mon stock » (vue par boutique ou toutes boutiques, entrées, sorties, inventaires `MS-N` annulables, mouvements). Le moteur de stock simulé (`src/mocks/stock.ts`) garantit que la quantité est égale à la somme des mouvements et ne devient jamais négative. F4 apporte « Mes clients », la caisse plein écran `/vendre` (panier par boutique sur l'appareil, total calculé par l'API via `POST /sales/quote`, espèces avec rendu, paiement mixte, crédit avec client obligatoire, paniers en attente), « Mes ventes » (historique, détail, annulation) et les reçus 58/80 mm partagés sur WhatsApp par un lien signé (`/recu/:token`, public). Le moteur de vente simulé (`src/mocks/sales.ts`) sert aussi à générer l'historique de démonstration (`src/mocks/data/sales-seed.ts`). Les pages sont chargées à la demande (`lazy` dans `src/app/router.tsx`). F5 apporte « Mes crédits clients » (débiteurs, fiche crédit, paiements `RB-N` avec répartition et reçus, anciennes dettes, échéanciers, régularisations) et la décision P3 (avoir ou argent rendu) ; le moteur est `src/mocks/credits.ts`. F6 apporte les approvisionnements `AP-N` (entrée en stock, paiements fournisseur), les fournisseurs et les dépenses `DP-N` ; le moteur est `src/mocks/purchases.ts`. F7 apporte le tableau de bord sur l'accueil (distinction financière §7.8) et le journal d'activité (`src/mocks/audit.ts`) ; les dates de démo sont relatives au jour de génération (`src/mocks/data/dates.ts`). Toutes les rubriques du menu sont livrées. F8 apporte l'inscription `/inscription` (trois étapes, provisionnement, lien de connexion à usage unique), l'assistant de démarrage `/demarrage`, « Mon abonnement » (paiement GeniusPay simulé validé au webhook, limites du plan, factures) et la lecture seule des espaces suspendus (écritures refusées en 402) ; la démo gère plusieurs espaces (`src/mocks/platform.ts`, une base par espace). F9 rend l'application installable (vite-plugin-pwa, `src/sw/sw.ts`) et permet de vendre sans réseau : cache IndexedDB des réponses, file d'opérations `src/offline/` (ventes, paiements en espèces, dépenses) envoyée à `POST /shops/{id}/sync`, opérations « à vérifier », page `/synchronisation`. F10 comble les manques de la V1 relevés par `docs/rapports/comparaison-ancien-gstock.md` (comparaison avec l'ancien GStock, Stocky v5.0) : mot de passe oublié et `/profil`, photos (envoi multipart par `http.upload`, réduites sur l'appareil), scan par la caméra (`src/lib/barcode.ts`, zxing en repli), unité d'achat convertie par le serveur (`src/mocks/units.ts`), échéancier des dettes fournisseurs (moteur commun `src/mocks/installments.ts`) et produits à variantes (stock par produit, variante et boutique ; un article se repère par `articleKey` de `src/lib/articles.ts`).
- `Gstock-plateform/` : **socle (B1), référentiels (B2), produits et stock (B3), clients et ventes (B4), crédits clients (B5), approvisionnements et dépenses (B6), tableau de bord et journal (B7), inscription et abonnement (B8), synchronisation hors ligne (B9), back-office Filament (B10) livrés**, rapports `B1-…` à `B10-back-office.md` dans `Gstock-frontend/docs/rapports/`. Laravel 12 (PHP ≥ 8.2), PostgreSQL 16 en Docker (`compose.yaml`), API `/api/v1` (`routes/api.php`), stancl/tenancy en base unique (espace = sous-domaine, identifiants entiers), Sanctum (cookie), permissions fixes créées par migration, rôles, utilisateurs, boutiques, paramètres, clés GeniusPay chiffrées, journal d'audit. Aucune donnée ni aucun compte de démonstration (supprimés le 10 novembre 2026 avant la mise en production) : le seeder ne crée que les formules (`PlanSeeder`). Code métier par contexte dans `app/Domain/<Contexte>/`, contrôleurs dans `app/Http/Controllers/Api/V1/`, formes JSON dans `app/Http/Resources/Present.php`, listes avec `app/Support/ListQuery.php`, erreurs métier par `App\Support\ApiException`. Référentiels (M05) : `app/Http/Controllers/Api/V1/Referentials/` (base commune `ReferentialController`), créés par défaut à l'inscription (`CreateDefaultReferentials`). Produits et stock (M06, M07) : `app/Domain/Catalog/` (`ProductService`, `Article`) et `app/Domain/Stock/` ; **toute variation de stock passe par `StockLedger::apply()`** (verrous, jamais négatif, mouvements) ; routes de boutique `/shops/{shop}/…` protégées par le middleware `shop` ; calcul décimal avec `App\Support\Decimal`, références avec `App\Support\DocumentSequence`. Ventes (M08, M10) : `app/Domain/Sales/` (`SaleCalculator` = calcul de référence §7.4-7.5, `SaleService` = enregistrement et annulation, `ReceiptLinks` = liens signés) ; une vente avec un reste crée un `CustomerCredit`. Crédits (M09) : `app/Domain/Credits/` (`CreditLedger` = soldes, répartition et avoirs, **tout reste à payer se recalcule par `recompute()`** ; `CreditService` = anciennes dettes `CR-N`, annulation et décision P3, régularisations, échéanciers ; `RepaymentService` = paiements `RB-N` ; `InstallmentSchedule` = échéancier générique, réutilisé pour les dettes fournisseurs). Produits d'un fournisseur et fournisseurs d'un produit (M11) : `app/Domain/Purchases/SupplierCatalog.php`, déduits des approvisionnements reçus (aucune table), « Racheter chez ce fournisseur » (`?fournisseur=` sur le formulaire d'approvisionnement, recherche `supplier_id`). Accueil (M13) : mini-courbe des ventes (`trend`, `SalesSparkline`) et rappel « à racheter dans les 7 jours » (`restock`, `RestockSoon`, calcul commun `ReportService::restockSoon()`). Approvisionnements et dépenses (M11, M12) : `app/Domain/Purchases/PurchaseService.php` (calcul, unité d'achat convertie en unité de base, entrée en stock, paiements fournisseur, échéancier `payable_type = purchase`, annulation) et `app/Domain/Expenses/ExpenseService.php`. Tableau de bord (M13) : `app/Domain/Reporting/DashboardService.php` (distinction financière §7.8, calcul SQL à la demande). Rapports (M15, première partie) : `app/Domain/Reporting/ReportService.php` (ventes jour par jour, ventes et marge par produit au prorata du total, prix sous le prix d'achat, à racheter, dormants ; clients : meilleurs, nouveaux, perdus, ancienneté des dettes, recouvrement, payeurs), permission `reports.view`, rubrique `/rapports` (`src/features/reports/`, graphique SVG sans bibliothèque). Inscription et abonnement (M00) : `app/Domain/Platform/Registration/` (inscription, lien de connexion à usage unique), `OnboardingService`, `app/Domain/Platform/Billing/` (abonnement, factures `tenant_invoices`, webhook signé) ; GeniusPay passe par l'interface `PlatformGateway`, dont seul le pilote `simulation` existe (refusé en production) en attendant la documentation et les clés. Synchronisation hors ligne : `app/Domain/Sync/SyncService.php` (`POST /shops/{id}/sync`, une opération à la fois, statuts `created`, `duplicate`, `to_review`, `rejected`). Back-office (M01) : panneau Filament 5 sur `/admin` (`ADMIN_DOMAIN` en production), garde `platform` (table `platform_admins`, création par `php artisan gstock:admin`), écrans dans `app/Filament/`, actions sensibles et journal dans `app/Domain/Platform/Admin/` (motif obligatoire, `platform_audit_logs`) ; dans Filament, nommer les arguments des fonctions `$query`, `$data`, `$record`. Dates de péremption (§7.11) : toujours visibles dans Mon stock (`summary.tracked`, `filter[expiry]=tracked`) ; arrivages `stock_lots` tenus par `StockLots`, appelé par `StockLedger::apply()` pour les produits suivis (`track_expiry`) ; règles de date dans `app/Domain/Stock/Expiry.php`. Transferts entre boutiques (§7.12) : `app/Domain/Stock/TransferService.php` (envoi `TR-N`, réception, annulation avant réception), permission `stock.transfer`. Fournisseur d'un approvisionnement (M11, cahier v3.3) : raccourci « Nouveau fournisseur » dans le formulaire (`SupplierSelect`) et attribution après coup à un approvisionnement sans fournisseur (`PurchaseService::assignSupplier()`, `PUT /shops/{id}/purchases/{id}/supplier`), jamais de remplacement. Produit créé sur place (M06, v3.4) : `ProductPicker allowCreate` + `QuickProductForm`, dans l'approvisionnement et l'entrée en stock, sans quantité de départ. Référentiels créés sur place (M05, v3.5) : `QuickReferentialCreate` sous les listes catégorie, marque et catégorie de dépense. Règle d'homogénéité : toute liste d'un élément que l'utilisateur peut créer propose de le créer sur place (clients, fournisseurs, produits, catégories, marques). Fin des données simulées : `npm run dev` parle toujours au backend (rapport `fin-donnees-simulees.md`) ; plus de comptes de test (rapport `retrait-comptes-test.md`). Connexion centrale (ADR-009) : sur le domaine principal, `POST /auth/central-login` (`CentralLoginController`) renvoie les espaces du compte avec un lien de connexion à usage unique ; côté front, `isCentralHost()` (`src/lib/tenant-host.ts`). Déploiement (Coolify) : `docker-compose.coolify.yml` à la racine (db, api, worker, web, backup ; sous-domaines en joker par labels Traefik), image du frontend `Gstock-frontend/Dockerfile` (Caddy, transmet `/api`, `/sanctum`, `/storage`), feuille de route `DEPLOIEMENT-COOLIFY.md`, rapport `deploiement-coolify.md`. Pas encore : pilote GeniusPay réel.

## Commandes

### Backend (`Gstock-plateform/`)

```bash
docker compose up -d           # PostgreSQL 16 (port 54329, bases gstock et gstock_test)
docker compose --profile app up -d --build   # + l'API dans l'image de production, sur http://localhost:8001 (back-office /admin)
composer setup                 # install, .env, key:generate, migrate, npm install + build
php artisan migrate:fresh --seed   # base vide avec les formules d'abonnement (aucun compte)
php artisan gstock:admin vous@exemple.ci   # administrateur du back-office /admin
composer dev                   # serve + queue:listen + pail (logs) + vite, en parallèle
composer test                  # config:clear puis php artisan test
php artisan test --filter=NomDuTest          # un seul test
php artisan test tests/Feature/FooTest.php   # un seul fichier
vendor/bin/pint                # formatage / lint PHP
```

Les tests tournent sur PostgreSQL (base `gstock_test`, `phpunit.xml`), avec les suites `Unit` et `Feature`. Chaque test crée ses espaces (`createTenant()`, `createUser()`) et appelle l'API sur leur sous-domaine (`$this->api('kone', 'GET', '/me', as: $user)`, domaine central `gstock.test`). L'isolation des espaces est testée (`TenantIsolationTest`) : toute nouvelle table d'espace doit utiliser le trait `App\Support\BelongsToTenant`.

### Frontend (`Gstock-frontend/`)

```bash
npm run dev        # serveur Vite branché sur le backend (proxy vers l'API Docker 127.0.0.1:8001, ou GSTOCK_API_URL) : ouvrir http://localhost:5173
npm run build      # tsc (vérification des types) puis vite build
npm run typecheck  # tsc seul
npm run lint       # oxlint : interdit fetch/axios hors de src/lib/api/client.ts
npm run preview
```

- Plus de données simulées (ADR-004 close le 5 novembre 2026) : le frontend a besoin du backend. Lancer l'API (`docker compose --profile app up -d --build` dans `Gstock-plateform/`), puis `npm run dev`.
- Aucun compte de test : pour essayer, créer un espace par « Créer mon espace » (`/inscription`), puis ses utilisateurs dans Paramètres.
- Textes : un fichier JSON par partie dans `src/locales/fr/`, réunis dans `src/lib/i18n.ts`. Les clés sont typées et les pluriels utilisent `_one` / `_other`.
- La vitrine des composants est accessible en développement sur `/vitrine`.
- Composants shadcn : `npx shadcn add <composant>`. Il faut ensuite les rhabiller selon `MASTER.md` et remplacer l'import `cn` par `@/lib/utils`. Attention : la commande propose d'écraser `button.tsx`, qui est personnalisé. Il faut refuser.
- Aucun outil de test frontend n'est encore configuré.

## Architecture cible (à respecter)

**Deux applications séparées.** Laravel expose une API REST et le panneau Filament super-admin. React est la PWA du commerçant. Le frontend ne calcule **aucun montant de référence** : il affiche ce que renvoie l'API. Le backend suit une approche DDD par contextes (Plateforme, Identité et accès, Boutiques, Catalogue, Stock, Ventes, Crédits, Tiers, Approvisionnements, Dépenses, Reporting, Audit). Le DDD complet est réservé aux contextes Ventes, Crédits et Stock ; les référentiels restent en CRUD simple.

**Multi-tenant (ADR-002, 009, 011).** Une seule base PostgreSQL. Chaque table métier porte un `tenant_id`, filtré par le trait `BelongsToTenant` de stancl/tenancy. L'espace est identifié par le sous-domaine, jamais par un paramètre envoyé par le client. Toutes les contraintes d'unicité incluent `tenant_id`. Un espace contient plusieurs boutiques (`shops`). Le catalogue, les clients, les fournisseurs et les rôles sont communs à l'espace. Les opérations (ventes, stock, crédits, dépenses, approvisionnements) portent un `shop_id`, et chaque requête vérifie l'affectation de l'utilisateur à la boutique (`shop_user`) ainsi que sa permission. Les tables plateforme (`tenants`, `plans`, `tenant_subscriptions`, `tenant_invoices`, `platform_admins`) n'ont pas de `tenant_id` et ne sont accessibles qu'à Filament, via la garde `platform`.

**Permissions (ADR-014).** La liste des permissions est fixée dans le code ; une nouvelle permission s'ajoute par migration et n'est accordée qu'à Owner. Les rôles sont libres, chaque utilisateur en a un seul, et le rôle Owner est immuable. Les contrôles se font côté serveur sur chaque endpoint. Sans `records.view_all`, un utilisateur ne voit que ses propres opérations.

**Règles invariantes :**
- Opérations financières (ventes validées, paiements, crédits, remboursements, dépenses) : jamais de suppression ni de modification. On les annule via `POST /.../{id}/cancel` avec un `reason` obligatoire, et l'action est journalisée dans `audit_logs` (ADR-012).
- Stock : il est tenu par (produit, variante, boutique) dans `shop_stock.quantity`, en **unité de base**, et doit toujours égaler la somme des `stock_movements`. **Il ne devient jamais négatif** : contrôle dans la transaction, avec verrouillage de la ligne `shop_stock`, sinon réponse 422 avec un message en français (§7.2).
- Références `PRÉFIXE-N` (`V-`, `CR-`, `RB-`, `AP-`, `MS-`, `DP-`) numérotées par espace, via `document_sequences` verrouillée en transaction.
- Hors ligne (ADR-005) : `offline_uuid` idempotent ; la référence définitive est attribuée par le serveur ; un conflit est marqué « à vérifier », jamais perdu. Aucun paiement GeniusPay hors ligne.
- GeniusPay (ADR-003) : deux intégrations (abonnement plateforme et encaissements des boutiques, avec les clés chiffrées dans `tenant_payment_settings`). Un paiement n'est validé qu'à réception du webhook (`/webhooks/geniuspay/platform`, `/webhooks/geniuspay/{tenant}`).

**Conventions d'API (§9).** Préfixe `/api/v1`, JSON en snake_case. Les ressources d'espace sont sous `/api/v1/products` et les ressources de boutique sous `/api/v1/shops/{shop_id}/...`. Les listes renvoient `{data, meta:{current_page, per_page, total, last_page}}` et acceptent les paramètres `page`, `per_page`, `search`, `sort=-champ` et `filter[x]`. Les montants sont des chaînes décimales (`"15000.00"`, `NUMERIC` en base) et les dates sont en ISO 8601. Les erreurs 422 suivent le format `{message, errors}` avec des messages en français.

**Langue (ADR-006, 007).** Base de données, code et API en **anglais** (snake_case ; par exemple boutique = `shops`, crédit client = `customer_credits`, remboursement = `credit_repayments`, approvisionnement = `purchases`). Interface utilisateur **uniquement en français**, avec des textes externalisés (react-i18next, fichiers de langue Laravel) et la terminologie simple du §3.2 : « Vendre », « Mettre à crédit », « Reste à payer », « Argent reçu », « Boutique ». Les termes techniques n'apparaissent jamais dans l'interface.

## Frontend : organisation (ADR-004 close)

Le frontend a d'abord été développé sur des données simulées (MSW) ; depuis le 5 novembre 2026 elles sont retirées et chaque évolution se fait directement avec le backend : contrat d'API (types TS dans `src/types/` + fonctions dans `src/lib/api/`), règles et tests côté Laravel. La structure est `src/{app,components,features/<module>,lib,offline,types,locales/fr}`, et chaque dossier de `features/` contient ses pages, ses composants, ses hooks et ses schémas (§11.2). L'ordre de livraison suit les phases F1 → F9 (§11.4).

**Couche réseau centralisée (§11.2).** Tous les appels HTTP sont dans `src/lib/api/` : `client.ts` est le seul fichier qui appelle `fetch` (URL de base, jeton, erreurs typées), et chaque module a son fichier (`products.ts`, `sales.ts`…) qui expose des fonctions typées. Les pages, composants, hooks et stores n'appellent jamais `fetch` et n'écrivent jamais d'URL d'API : ils importent ces fonctions. `lib/api/` ne contient aucun code React.

Côté UX (§3), le mobile est prioritaire : accès immédiat à « Vendre », grands boutons, tableaux affichés en listes de cartes sur mobile. Chaque carte est cliquable et mène quelque part. Chaque écran gère les états chargement, succès, erreur et vide. Le sélecteur de boutique n'apparaît que si l'utilisateur a accès à plusieurs boutiques. Le skill `ui-ux-pro-max` (`.claude/skills/`) est disponible pour le travail de design.

**Design system (direction « Marché »).** La source de vérité visuelle est `Gstock-frontend/design-system/gstock/MASTER.md` : couleurs, typographie Outfit, contours épais et ombres décalées, composants de référence et interdits. Lisez-le avant de créer ou de modifier un écran ou un composant, et vérifiez si un fichier `pages/<page>.md` le complète pour la page concernée. La maquette `reference.html` (direction B) sert d'exemple. Les composants shadcn sont rhabillés avec ces variables : on ne garde jamais leur thème par défaut.

## Méthode de travail

Avant toute modification importante :

1. Comprendre le code existant.
2. Identifier les fichiers concernés.
3. Vérifier les impacts.
4. Implémenter la solution la plus simple.
5. Tester.

## Rapport de fin de phase (obligatoire)

Chaque phase terminée (F1, F2… du §11.4, ou toute autre étape livrée sur sa propre branche) **doit** avoir son rapport dans `Gstock-frontend/docs/rapports/`. Le rapport se rédige sans attendre qu'on le demande : c'est la dernière tâche de la phase, une fois tout le reste commité et testé, **avant la fusion de la branche dans `main`**.

1. Créer `Gstock-frontend/docs/rapports/F<n>-<nom-court>.md` sur le modèle des rapports existants (par exemple `F4-clients-ventes.md`). Le rapport contient :
   - le statut, la branche et le livrable du cahier ;
   - le tableau des commits de la phase ;
   - les écrans livrés, avec leur adresse et la permission requise ;
   - les fichiers clés et les endpoints, réels ou simulés ;
   - les règles du cahier appliquées ;
   - les décisions prises pendant la phase ;
   - les vérifications faites ;
   - les limites restantes.
2. Mettre à jour `Gstock-frontend/docs/rapports/README.md` : ligne de la phase dans le tableau, décisions, contrat d'API (endpoints ajoutés), pièges rencontrés, date de mise à jour.
3. Mettre à jour la section « État actuel » de ce fichier.
4. Faire un commit dédié, `docs: rapport de la phase F<n>`, sur la branche de la phase, puis fusionner.

Le dossier `rapports/` ne décrit **que ce qui a été fait** : aucun fichier pour une phase non commencée ou en cours. Les écarts avec le cahier (endpoints ajoutés, décisions sur des points ouverts) y sont signalés pour être reportés dans le cahier.

## Git

- Créer un commit après chaque action majeure.
- Les commits doivent être atomiques, cohérents et explicites.
- Ne pas mélanger plusieurs fonctionnalités indépendantes dans un même commit.
- Noms de branches courts mais compréhensibles par quelqu'un qui découvre le projet : deux ou trois mots, en minuscules, séparés par des tirets, qui disent de quoi il s'agit (ex. `front-socle`, `front-produits`, `api-ventes`, `fix-stock`). Pas de codes internes seuls (`f1`, `m08`) ni de noms longs.
- Ne jamais ajouter Claude comme co-auteur : pas de ligne `Co-Authored-By` ni de mention « Generated with Claude Code » dans les commits et les pull requests.
