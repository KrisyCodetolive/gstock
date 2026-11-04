# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

GStock : SaaS multi-tenant de gestion de stock, de point de vente (POS) et de crédits clients pour les petits commerces (Afrique de l'Ouest, FCFA, fuseau par défaut `Africa/Abidjan`). Éditeur : Genius Groups.

**La source de vérité est le cahier des charges** : `Gstock-plateform/docs/cahier-des-charges-gstock-final.md` (une copie identique se trouve dans `Gstock-frontend/docs/`. Si vous modifiez l'une, modifiez aussi l'autre). Il contient les ADR (§5), les permissions (§6.3), les règles de gestion (§7), le modèle de données (§8), les conventions d'API (§9) et le plan module par module M00–M14 (§10). Lisez la section concernée avant de coder un module.

## État actuel

- `Gstock-frontend/` : **phases F1 (socle), F2 (espace) et F3 (produits et stock) livrées**. On y trouve TypeScript, React Router, TanStack Query, Tailwind v4 + shadcn/ui (base Radix, rhabillé « Marché »), React Hook Form + Zod, Zustand, MSW et react-i18next. F1 apporte la connexion simulée avec 5 profils, les permissions, le sélecteur de boutique et les mises en page mobile et desktop. F2 apporte les paramètres de l'espace, GeniusPay, les boutiques, les rôles, les utilisateurs et les référentiels, sous `/parametres`. F3 apporte « Mes produits » (création rapide, fiche avec stock par boutique) et « Mon stock » (vue par boutique ou toutes boutiques, entrées, sorties, inventaires `MS-N` annulables, mouvements). Le moteur de stock simulé (`src/mocks/stock.ts`) garantit que la quantité est égale à la somme des mouvements et ne devient jamais négative. Les autres rubriques affichent « Bientôt disponible » jusqu'à leur phase. vite-plugin-pwa (F9) n'est pas encore installé.
- `Gstock-plateform/` : Laravel 12 (PHP ≥ 8.2) avec la configuration par défaut (SQLite, `routes/web.php` uniquement). Le cahier prévoit PostgreSQL, stancl/tenancy, Sanctum, Filament et GeniusPay, mais rien de tout cela n'est encore installé. Il n'y a pas encore de `routes/api.php`.

## Commandes

### Backend (`Gstock-plateform/`)

```bash
composer setup                 # install, .env, key:generate, migrate, npm install + build
composer dev                   # serve + queue:listen + pail (logs) + vite, en parallèle
composer test                  # config:clear puis php artisan test
php artisan test --filter=NomDuTest          # un seul test
php artisan test tests/Feature/FooTest.php   # un seul fichier
vendor/bin/pint                # formatage / lint PHP
```

Les tests tournent sur SQLite `:memory:` (`phpunit.xml`), avec les suites `Unit` et `Feature`.

### Frontend (`Gstock-frontend/`)

```bash
npm run dev        # serveur Vite, données simulées actives (.env.development : VITE_USE_MOCKS=true)
npm run build      # tsc (vérification des types) puis vite build
npm run typecheck  # tsc seul
npm run lint       # oxlint : interdit fetch/axios hors de src/lib/api/client.ts et src/mocks/
npm run preview
```

- Comptes de démonstration (mot de passe `demo1234`) : ils sont listés sur l'écran de connexion quand les mocks sont actifs, et définis dans `src/mocks/data/users.ts`.
- Données simulées : `src/mocks/db.ts` part des jeux de `src/mocks/data/` et garde les modifications dans le `localStorage` (`gstock.mock.db.v3`). Si la forme des données change, incrémentez la clé. L'écran de connexion propose de remettre les données à zéro. Les handlers (`src/mocks/handlers/`) appliquent les règles du serveur (permissions, validation 422 en français, unicité, limites du plan) à l'aide de `src/mocks/http.ts`.
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

## Frontend : approche « d'abord le front » (ADR-004)

Le frontend est développé en premier, sur des données simulées. Pour chaque module, on définit d'abord le contrat d'API (types TS + endpoints), puis on écrit des handlers MSW qui appliquent les mêmes règles que le serveur (totaux, stock, soldes). `VITE_USE_MOCKS=true` active MSW. La structure prévue est `src/{app,components,features/<module>,lib,offline,mocks,types,locales/fr}`, et chaque dossier de `features/` contient ses pages, ses composants, ses hooks et ses schémas (§11.2). L'ordre de livraison suit les phases F1 → F9 (§11.4).

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

## Git

- Créer un commit après chaque action majeure.
- Les commits doivent être atomiques, cohérents et explicites.
- Ne pas mélanger plusieurs fonctionnalités indépendantes dans un même commit.
- Noms de branches courts mais compréhensibles par quelqu'un qui découvre le projet : deux ou trois mots, en minuscules, séparés par des tirets, qui disent de quoi il s'agit (ex. `front-socle`, `front-produits`, `api-ventes`, `fix-stock`). Pas de codes internes seuls (`f1`, `m08`) ni de noms longs.
- Ne jamais ajouter Claude comme co-auteur : pas de ligne `Co-Authored-By` ni de mention « Generated with Claude Code » dans les commits et les pull requests.
