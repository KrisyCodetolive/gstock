# Cahier des charges — GStock

## Logiciel de gestion de stock, de point de vente et de crédits clients pour les petits commerces, en SaaS

| | |
|---|---|
| **Éditeur** | Genius Groups SAS |
| **Version** | 3.1 — ajout des dates de péremption (§7.11) ; v3.0 : fusion du cahier des charges produit (v2.0) et du cahier des charges technique |
| **Date** | 5 novembre 2026 (connexion centrale, ADR-009 ; fin des données simulées, ADR-004) |
| **Cible** | Boutiques de quartier, épiceries, mini-markets, commerces de proximité et petits détaillants |
| **Statut** | Définitif pour la phase 1 — évolutif pour les phases suivantes |

---

## Sommaire

1. [Présentation du projet](#1-présentation-du-projet)
2. [Cibles et acteurs](#2-cibles-et-acteurs)
3. [Principes UX/UI](#3-principes-uxui)
4. [Périmètre et priorisation](#4-périmètre-et-priorisation)
5. [Décisions d'architecture (ADR)](#5-décisions-darchitecture-adr)
6. [Espaces, boutiques, rôles et permissions](#6-espaces-boutiques-rôles-et-permissions)
7. [Règles de gestion transverses](#7-règles-de-gestion-transverses)
8. [Modèle de données](#8-modèle-de-données)
9. [Conventions de l'API](#9-conventions-de-lapi)
10. [Plan de conception module par module](#10-plan-de-conception-module-par-module)
11. [Organisation du frontend](#11-organisation-du-frontend)
12. [Exigences non fonctionnelles](#12-exigences-non-fonctionnelles)
13. [Critères d'acceptation produit](#13-critères-dacceptation-produit)
14. [Indicateurs de réussite](#14-indicateurs-de-réussite)
15. [Planning de réalisation](#15-planning-de-réalisation)
16. [Livrables](#16-livrables)
17. [Points ouverts](#17-points-ouverts)
18. [Exigence finale de conception](#18-exigence-finale-de-conception)

---

## 1. Présentation du projet

### 1.1 Contexte

Les petits commerces de proximité jouent un rôle essentiel dans l'économie locale, mais leur gestion repose encore souvent sur des méthodes manuelles : cahiers pour les ventes et les crédits, calculatrice, mémoire du commerçant pour les dettes, comptage manuel du stock, notes informelles pour les approvisionnements, WhatsApp et appels pour communiquer.

Ces pratiques entraînent erreurs, oublis et pertes financières. GStock simplifie cette gestion avec un outil numérique accessible, intuitif et adapté aux habitudes des commerçants.

GStock est une application **SaaS** : une seule application, mise à jour une seule fois, utilisée par de nombreux commerçants. Chaque commerçant dispose d'un **espace** isolé dans lequel il peut gérer **une ou plusieurs boutiques**.

### 1.2 Vision produit

> **GStock vous aide à savoir ce que vous avez vendu, ce qu'il vous reste et surtout ce que vos clients vous doivent.**

GStock doit devenir le compagnon numérique du boutiquier : un outil simple pour vendre, suivre ses marchandises, gérer les crédits accordés aux clients et comprendre l'activité de ses boutiques.

### 1.3 Objectifs

- Digitaliser la gestion quotidienne des petits commerces.
- Simplifier l'enregistrement des ventes et des encaissements.
- Permettre un suivi fiable du stock, boutique par boutique.
- Centraliser les crédits accordés aux clients habitués et leurs remboursements.
- Donner une visibilité claire sur les recettes, les dépenses et les sommes dues.
- Permettre de gérer plusieurs boutiques depuis un même espace.
- Encaisser en Mobile Money et par carte via GeniusPay.
- Continuer à vendre même sans connexion internet.
- Garantir l'exactitude des chiffres : tous les calculs sont faits et contrôlés par le serveur.

### 1.4 Positionnement

GStock n'est ni un logiciel comptable ni un ERP. Il répond aux opérations quotidiennes d'un petit commerce :

1. Vendre des produits.
2. Encaisser de l'argent.
3. Accorder un crédit à un client.
4. Enregistrer un remboursement.
5. Connaître les produits disponibles.
6. Réapprovisionner la boutique.
7. Consulter les résultats de la journée.

**La simplicité d'utilisation est une exigence fonctionnelle à part entière.**

---

## 2. Cibles et acteurs

### 2.1 Cible principale

Boutiques de quartier, épiceries, mini-markets, petits commerces alimentaires, boutiques de cosmétiques, commerces de détail, petits magasins de fournitures et d'accessoires. Un même commerçant peut posséder plusieurs points de vente.

### 2.2 Profil principal : le boutiquier

- Expérience limitée des logiciels de gestion.
- Utilise principalement un **smartphone Android**, parfois un ordinateur ou une tablette.
- Ventes fréquentes et rapides, peu de temps pour la saisie.
- Connaît ses clients habituels et leur accorde parfois des marchandises à crédit.

**Conséquence :** l'application doit être comprise immédiatement, utilisable sans formation technique et adaptée à un usage quotidien sur mobile.

### 2.3 Acteurs

| Acteur | Où il travaille | Responsabilités |
|---|---|---|
| Super-admin plateforme | Back-office Filament (Genius Groups) | Supervise les espaces, leurs boutiques et leurs utilisateurs ; gère les plans, les abonnements et le support |
| Propriétaire | Application GStock | Créateur de l'espace. Tous les droits sur toutes ses boutiques ; gère l'abonnement, les boutiques, les rôles et les utilisateurs |
| Collaborateurs | Application GStock | Personnes qui travaillent dans les boutiques. Leurs droits dépendent du rôle que le propriétaire leur attribue |
| Client final | — | Client de la boutique. Pas de compte ; il paie en espèces, en Mobile Money ou prend à crédit |

Seul le rôle **Owner** (propriétaire) existe à la création de l'espace. Les autres rôles (par exemple gérant, vendeur, caissier, gestionnaire de stock) sont créés et nommés librement par le propriétaire (§6).

---

## 3. Principes UX/UI

### 3.1 Simplicité radicale

- Mots simples et familiers ; informations demandées limitées au strict nécessaire.
- Formulaires courts ; actions directes ; boutons larges.
- Informations importantes immédiatement visibles ; menus peu profonds.
- Confirmations compréhensibles.
- Possibilité de corriger une erreur sans perdre l'historique.
- Les options avancées (variantes, taxes, unités d'achat, marques) sont masquées par défaut et activables dans les paramètres.

### 3.2 Terminologie

| À utiliser | À éviter |
|---|---|
| Vendre | Créer une transaction POS |
| Mettre à crédit | Générer une créance |
| Client | Débiteur |
| Reste à payer | Encours client |
| Ajouter un produit | Créer une référence SKU |
| Argent reçu | Encaissement |
| Boutique | Entrepôt / tenant |

Les termes techniques restent dans le code et l'API, jamais dans l'interface courante.

### 3.3 Cartes interactives

Les cartes sont un principe transversal. Une carte n'est jamais décorative : elle ouvre un détail ou déclenche une action.

Chaque carte comporte selon son rôle : un titre explicite, une valeur principale, une courte explication si nécessaire, un indicateur visuel, une destination ou une action, un état au survol (desktop) et un retour visuel au toucher (mobile).

Types de cartes : navigation, statistique, information, action rapide, suivi et alerte. Elles sont cohérentes dans toute l'application. **Aucune carte cliquable ne doit mener nulle part.**

### 3.4 Responsive

**Mobile (prioritaire pour le quotidien)** : navigation simple, accès immédiat à « Vendre », boutons tactiles larges, cartes empilées, tableaux convertis en listes de cartes, formulaires courts, clavier numérique pour les montants et quantités.

**Desktop** : navigation latérale, tableaux complets, plusieurs indicateurs simultanés, filtres et recherche, gestion détaillée.

Le responsive adapte les composants et la navigation à chaque écran ; il ne se contente pas de réduire l'interface desktop.

### 3.5 Accessibilité et confort

Contrastes suffisants, typographie lisible, icônes accompagnées de libellés, couleur jamais seule porteuse d'information, états de chargement / succès / erreur / vide sur chaque écran, messages d'erreur en français simple.

### 3.6 Sélecteur de boutique

Un utilisateur qui a accès à plusieurs boutiques voit la boutique courante en haut de l'écran et peut en changer en un geste. Le propriétaire dispose aussi d'une vue « Toutes mes boutiques » sur le tableau de bord et les rapports. Un utilisateur qui n'a accès qu'à une boutique ne voit pas de sélecteur.

---

## 4. Périmètre et priorisation

### 4.1 Phase 1 — Cœur : gestion quotidienne (V1)

| # | Module |
|---|---|
| M00 | Plateforme SaaS : inscription, plans, abonnement GeniusPay |
| M01 | Back-office super-admin (Filament) |
| M02 | Authentification et profil |
| M03 | Espace, boutiques et paramètres (dont clés GeniusPay) |
| M04 | Utilisateurs, rôles et permissions |
| M05 | Référentiels : catégories, unités, modes de paiement, catégories de dépenses |
| M06 | Mes produits |
| M07 | Mon stock : entrées, sorties, ajustements, historique, alertes, dates de péremption |
| M08 | Ventes / Point de vente (POS), paiement immédiat, mixte ou à crédit, en ligne puis hors ligne |
| M09 | Mes crédits clients : crédits, remboursements, échéances, reçus |
| M10 | Mes clients |
| M11 | Approvisionnements et fournisseurs (version simple) |
| M12 | Dépenses (version simple) |
| M13 | Tableau de bord |
| M14 | Journal d'audit |

Les approvisionnements et les dépenses sont avancés en phase 1 dans une version simple, car le tableau de bord (cartes « Dépenses », « Résultat estimé », action rapide « Ajouter un approvisionnement ») et le stock en dépendent.

### 4.2 Phase 2 — Gestion approfondie

Caisse (ouverture, clôture, mouvements, solde), recettes hors ventes, retours de marchandises, inventaire physique, transferts de stock entre boutiques, rapports et statistiques, import / export de produits, partage de reçus amélioré, prix différents par boutique (si validé, §17).

### 4.3 Phase 3 — Extension

Devis, commandes fournisseurs avancées (statuts, réception partielle), produits combo, notifications SMS, intégrations avancées, automatisations configurables, reporting avancé.

### 4.4 Hors périmètre

- **Assistant intelligent / IA** : non implémenté pour l'instant.
- Scoring de clients, octroi automatique de crédit, prêt ou financement, recouvrement automatique, relances envoyées sans action du commerçant.
- Boutique en ligne publique.
- Applications mobiles natives (l'application est une PWA installable).
- Interface multilingue (français uniquement, ADR-006).

---

## 5. Décisions d'architecture (ADR)

Chaque ADR suit le format : statut, contexte, décision, conséquences. **Acceptée** = validée par l'équipe. **Proposée** = recommandation à valider.

| ADR | Sujet | Date | Statut |
|---|---|---|---|
| ADR-001 | Stack et architecture | 28 octobre 2026 | Acceptée |
| ADR-002 | Multi-tenant par `tenant_id` avec stancl/tenancy | 3 novembre 2026 | Acceptée |
| ADR-003 | Paiements avec GeniusPay | 3 novembre 2026 | Acceptée |
| ADR-004 | Frontend d'abord, sur données simulées (remplacées par le backend le 5 novembre 2026) | 3 novembre 2026 | Acceptée, puis close |
| ADR-005 | Mode hors ligne en PWA | 3 novembre 2026 | Acceptée |
| ADR-006 | Interface en français uniquement | 3 novembre 2026 | Acceptée |
| ADR-007 | Modèle de données en anglais | 3 novembre 2026 | Acceptée |
| ADR-008 | Authentification avec Laravel Sanctum | 3 novembre 2026 | Proposée |
| ADR-009 | Identification de l'espace par sous-domaine | 3 novembre 2026 | Proposée |
| ADR-010 | Back-office super-admin avec Filament | 3 novembre 2026 | Acceptée |
| ADR-011 | Plusieurs boutiques par espace | 3 novembre 2026 | Acceptée |
| ADR-014 | Permissions prédéfinies, rôles libres, un rôle par utilisateur | 3 novembre 2026 | Acceptée |
| ADR-012 | Opérations financières non supprimables | 3 novembre 2026 | Acceptée |
| ADR-013 | Partage des reçus par lien WhatsApp | 3 novembre 2026 | Proposée |

### ADR-001 — Stack et architecture

**Statut.** Acceptée le 28 octobre 2026.

**Contexte.** Le métier est riche : stock, ventes à crédit, remboursements, conversions d'unités, statuts de paiement. Ces règles doivent rester centralisées côté serveur et testables.

**Décision.**

| Couche | Choix | Pourquoi |
|---|---|---|
| Backend | Laravel | Files de tâches, ordonnanceur, PDF et exports disponibles nativement ou via des paquets éprouvés |
| Frontend | React | Interface réactive pour le POS, les cartes interactives et les listes ; écosystème riche |
| Base de données | PostgreSQL | Montants exacts (`NUMERIC`), séquences sûres en concurrence, transactions robustes |
| Architecture | Domain-Driven Design | Règles métier centralisées côté serveur, testables, découpées par domaine |

Le backend et le frontend sont deux applications séparées. Le frontend ne calcule aucun montant de référence : il affiche ce que l'API renvoie. Contextes du backend : Plateforme, Identité et accès, Boutiques, Catalogue, Stock, Ventes, Crédits, Tiers, Approvisionnements, Dépenses, Reporting, Audit.

**Conséquences.** Règles critiques testées côté serveur, modules livrables par phases, une seule base de code. En contrepartie : plus de code qu'un MVC classique, deux applications à maintenir. Le DDD complet est réservé aux contextes riches (Ventes, Crédits, Stock) ; les référentiels restent en CRUD simple.

### ADR-002 — Multi-tenant par `tenant_id` avec stancl/tenancy

**Statut.** Acceptée.

**Contexte.** Tous les commerçants partagent la même application ; leurs données doivent être strictement isolées.

**Décision.** Une seule base PostgreSQL. Chaque table métier porte `tenant_id` (l'espace du commerçant). Le paquet **stancl/tenancy** en mode base unique applique automatiquement le filtre (trait `BelongsToTenant`).

**Conséquences.**
- Toutes les contraintes d'unicité incluent `tenant_id`.
- Jobs et tâches planifiées s'exécutent dans le contexte du bon espace.
- Les tables de la plateforme (`tenants`, `plans`, `tenant_subscriptions`, `tenant_invoices`, `platform_admins`) ne sont accessibles qu'au back-office super-admin.
- Un test automatisé vérifie qu'un utilisateur ne peut jamais lire ni modifier les données d'un autre espace.

### ADR-003 — Paiements avec GeniusPay

**Statut.** Acceptée.

**Contexte.** Deux flux d'argent : les commerçants paient leur abonnement à Genius Groups, et les clients finaux paient les boutiques. GeniusPay couvre Wave, Orange Money, MTN Money, Moov Money et la carte bancaire, et fournit un paquet Laravel.

**Décision.** Deux intégrations séparées.

| Flux | Clés | Stockage | Bénéficiaire |
|---|---|---|---|
| Abonnement SaaS | Clés de Genius Groups | Variables d'environnement du serveur | Genius Groups |
| Encaissements des boutiques | Clés du commerçant | Table `tenant_payment_settings`, chiffrées | Le commerçant |

**Conséquences.**
- Deux webhooks : `/webhooks/geniuspay/platform` et `/webhooks/geniuspay/{tenant}`, chacun vérifié avec son secret.
- Les clés ne sont jamais renvoyées en clair par l'API.
- Sans clés configurées, le paiement Mobile Money / carte est masqué ; espèces et crédit restent disponibles.
- Un paiement GeniusPay n'est validé qu'à réception du webhook, jamais sur la seule redirection du navigateur.

### ADR-004 — Frontend d'abord, sur données simulées

**Statut.** Acceptée.

**Décision.** Le frontend est développé en premier. Pour chaque module, on définit d'abord le **contrat d'API** (types TypeScript et endpoints). Les données simulées passent par **MSW (Mock Service Worker)**.

| Besoin | Choix |
|---|---|
| Base | React + Vite + TypeScript |
| Navigation | React Router |
| Appels API et cache | TanStack Query |
| Interface | Tailwind CSS + shadcn/ui |
| Formulaires et validation | React Hook Form + Zod |
| État du panier POS et boutique courante | Zustand |
| Données simulées | MSW + jeux de données JSON |
| Hors ligne | vite-plugin-pwa + IndexedDB |

**Conséquences.** L'application fait de vrais appels `fetch`, tous centralisés dans `src/lib/api/` (§11.2) ; passer au backend réel consiste à désactiver MSW. Le contrat d'API est la spécification du backend. Les mocks appliquent les mêmes règles que le serveur (totaux, stock, soldes de crédit).

**Clôture (5 novembre 2026).** Le backend couvrant tous les modules, les données simulées (MSW) sont **retirées** du frontend : `npm run dev` parle toujours au backend Laravel, et les comptes de test viennent de ses seeders (`php artisan migrate:fresh --seed`, espace « alimentation-kone », mot de passe `demo1234`). La référence du contrat d'API et des règles devient le backend (ses tests) ; les types TypeScript restent dans `src/types/`.

### ADR-005 — Mode hors ligne en PWA

**Statut.** Acceptée.

**Contexte.** La connexion est souvent instable dans les commerces ciblés ; la vente ne doit pas s'arrêter.

**Décision.** L'application est une PWA installable. Hors ligne, elle utilise un cache local (IndexedDB) des produits, prix, stock, clients et soldes de la boutique courante. Opérations possibles hors ligne : **ventes (y compris à crédit), remboursements en espèces, dépenses**. Elles sont synchronisées au retour du réseau.

**Conséquences.**
- Chaque opération hors ligne porte un `offline_uuid` généré par l'appareil ; le serveur ne l'enregistre jamais deux fois.
- La référence définitive est attribuée par le serveur à la synchronisation ; l'appareil affiche une référence provisoire.
- Pas de paiement GeniusPay hors ligne.
- Les conflits (stock insuffisant, client modifié ailleurs) sont **détectés et signalés**, jamais perdus silencieusement : l'opération est enregistrée et marquée « à vérifier ».
- Soldes clients et mouvements financiers recalculés par le serveur après synchronisation.
- Le POS est d'abord livré en ligne, puis le mode hors ligne est ajouté.

### ADR-006 — Interface en français uniquement

**Statut.** Acceptée.

**Décision.** Interface, reçus et messages en français simple, avec la terminologie du §3.2. Les textes sont externalisés (react-i18next côté front, fichiers de langue Laravel côté back) pour permettre une autre langue plus tard.

### ADR-007 — Modèle de données en anglais

**Statut.** Acceptée.

**Décision.** Une seule base. Tables et colonnes en anglais, en snake_case. Montants et quantités en `NUMERIC`. Statuts en énumérations explicites. Détail au §8.

| Terme métier | Table |
|---|---|
| Espace du commerçant | `tenants` |
| Boutique | `shops` |
| Client | `customers` |
| Fournisseur | `suppliers` |
| Approvisionnement | `purchases` |
| Article d'approvisionnement | `purchase_items` |
| Crédit client | `customer_credits` |
| Remboursement | `credit_repayments` |
| Échéance | `installments` |
| Dépense | `expenses` |

**Conséquences.** D'autres tables seront ajoutées au fil du développement, avec les mêmes conventions.

### ADR-008 — Authentification avec Laravel Sanctum

**Statut.** Proposée.

**Décision.** Sanctum en mode SPA (cookie de session sécurisé) pour l'application web ; jeton d'API Sanctum par appareil pour la PWA installée, qui doit se resynchroniser après une coupure.

**Conséquences.** Protection CSRF native ; jetons révocables par appareil.

### ADR-009 — Identification de l'espace par sous-domaine

**Statut.** Proposée.

**Décision.** Chaque espace a un sous-domaine (`maboutique.gstock.app`). stancl/tenancy identifie l'espace par le domaine. Le domaine principal héberge le site, l'inscription, la **connexion centrale** et le back-office super-admin.

**Connexion centrale** (5 novembre 2026). Le commerçant n'a pas à connaître l'adresse de son espace : il se connecte sur le domaine principal (`gstock.app`) avec son e-mail ou son téléphone et son mot de passe. Le serveur cherche les espaces où ce compte existe **avec ce mot de passe** (aucun espace n'est révélé sans mot de passe juste), puis renvoie vers le sous-domaine avec un lien de connexion à usage unique. S'il y a plusieurs espaces, la personne choisit. L'adresse directe du sous-domaine reste utilisable.

**Conséquences.** Certificat TLS wildcard nécessaire. Un compte appartient à un espace ; une même personne peut avoir un compte dans plusieurs espaces (même e-mail), et choisit alors l'espace à la connexion centrale. Le mot de passe oublié se traite sur le sous-domaine de l'espace.

### ADR-010 — Back-office super-admin avec Filament

**Statut.** Acceptée.

**Contexte.** Genius Groups doit superviser les commerçants, leurs boutiques, leurs utilisateurs et leurs abonnements. Ce back-office est interne et n'a pas besoin de l'ergonomie mobile de l'application commerçant.

**Décision.** Le back-office est un panneau **Filament** intégré à l'application Laravel, servi sur le domaine central (`admin.gstock.app`). Il utilise une authentification séparée (garde `platform`, table `platform_admins`), hors du contexte d'un espace.

**Conséquences.**
- Écrans de supervision produits rapidement (tables, filtres, formulaires, widgets Filament) sans toucher à l'application React.
- Le panneau lit les données de tous les espaces : chaque requête doit désactiver explicitement le filtre de tenant, et l'accès est réservé aux super-admins.
- Les actions sensibles (suspension, connexion en tant qu'utilisateur pour le support) sont journalisées.
- Le super-admin voit des **indicateurs agrégés** ; l'accès au détail des opérations d'un commerçant passe par le mode support, tracé.

### ADR-011 — Plusieurs boutiques par espace

**Statut.** Acceptée.

**Contexte.** Un commerçant peut avoir plusieurs points de vente et veut les administrer depuis le même espace.

**Décision.**
- Un **espace** (`tenants`) contient **une ou plusieurs boutiques** (`shops`). Chaque boutique a son propre stock, ses ventes, ses crédits, ses dépenses et ses paramètres de caisse.
- Le **catalogue de produits**, les **clients**, les **fournisseurs** et les **rôles** sont communs à l'espace.
- Un utilisateur est affecté à une ou plusieurs boutiques (table `shop_user`). Son rôle, unique, s'applique dans toutes ses boutiques (ADR-014).
- Le propriétaire a automatiquement accès à toutes les boutiques.

**Conséquences.**
- Toutes les opérations (ventes, stock, crédits, dépenses, approvisionnements) portent un `shop_id`.
- Chaque requête vérifie que l'utilisateur est affecté à la boutique concernée et que son rôle a la permission.
- Le nombre de boutiques est limité par le plan d'abonnement.
- Les crédits d'un client sont suivis par boutique ; sa fiche affiche le solde par boutique et le total.

### ADR-012 — Opérations financières non supprimables

**Statut.** Acceptée.

**Contexte.** Le commerçant doit pouvoir faire confiance aux soldes. Une dette ou un paiement qui disparaît sans trace détruit cette confiance.

**Décision.**
- Une vente validée, un paiement, un crédit, un remboursement ou une dépense **ne peut pas être supprimé ni modifié directement**.
- En cas d'erreur, un utilisateur autorisé effectue une **annulation** ou une **régularisation**, avec un **motif obligatoire**. L'opération initiale reste consultable ; la correction est historisée ; soldes et stock sont recalculés.
- Seuls les brouillons (panier en attente) sont modifiables et supprimables.
- Les actions sensibles alimentent le journal d'audit (`audit_logs`).

**Conséquences.** Pas de bouton « Supprimer » sur les opérations financières, mais « Annuler » soumis à permission. Les rapports distinguent opérations valides et annulées.

### ADR-013 — Partage des reçus par lien WhatsApp

**Statut.** Proposée.

**Décision.** En phase 1, le partage d'un reçu ouvre WhatsApp (lien `wa.me` ou menu de partage natif du téléphone) avec un message pré-rempli et un **lien signé et expirant** vers le reçu. Le commerçant vérifie et envoie lui-même. L'API WhatsApp Business n'est pas utilisée.

**Conséquences.** Aucun envoi automatique au client ; aucun coût d'API ; conforme au principe « partage déclenché volontairement par le commerçant ».

### ADR-014 — Permissions prédéfinies, rôles libres, un rôle par utilisateur

**Statut.** Acceptée.

**Contexte.** Chaque commerçant organise son personnel différemment. Il doit pouvoir créer ses propres rôles, sans risquer de casser le contrôle d'accès.

**Décision.**
1. **Les permissions sont prédéfinies et non modifiables.** La liste est fixée dans le code (§6.3) ; aucun écran ne permet d'en créer, d'en renommer ou d'en supprimer.
2. **Les rôles sont libres.** Seul le rôle **Owner** est créé à l'inscription. Le propriétaire crée, nomme, modifie et supprime tous les autres rôles dans l'interface, en leur attribuant des permissions.
3. **Chaque utilisateur a un seul rôle**, qui s'applique dans toutes les boutiques auxquelles il est affecté.

**Conséquences.**
- Le rôle Owner a toutes les permissions ; il ne peut être ni modifié ni supprimé, et il est réservé au créateur de l'espace.
- À l'inscription, le propriétaire est le seul utilisateur. Pour ajouter un collaborateur, il crée d'abord au moins un rôle.
- Un rôle attribué à au moins un utilisateur ne peut pas être supprimé.
- Une nouvelle fonctionnalité qui ajoute une permission l'ajoute par migration ; elle n'est accordée à aucun rôle existant, sauf Owner.
- Pour qu'une personne ait des droits différents d'une boutique à l'autre, il faut deux comptes. Ce cas n'est pas prévu en phase 1.

---

## 6. Espaces, boutiques, rôles et permissions

### 6.1 Organisation

```
Espace (tenant) ── un commerçant, un abonnement
├── Boutiques (shops) ── stock, ventes, crédits, dépenses, approvisionnements
├── Catalogue de produits ── commun à toutes les boutiques
├── Clients et fournisseurs ── communs à toutes les boutiques
├── Permissions ── prédéfinies par GStock, non modifiables
├── Rôles ── Owner prédéfini ; tous les autres créés par le propriétaire
└── Utilisateurs ── un seul rôle chacun, affectés à une ou plusieurs boutiques
```

### 6.2 Principes

- Trois niveaux, conformément à l'ADR-014 :
  1. **Permissions** : prédéfinies et non modifiables.
  2. **Rôles** : libres, gérés par le propriétaire dans l'interface. Seul le rôle **Owner** existe au départ.
  3. **Utilisateurs** : un seul rôle chacun.
- L'utilisateur qui crée l'espace reçoit le rôle Owner : toutes les permissions, dans toutes les boutiques. Il ne peut pas être désactivé par un autre utilisateur.
- Chaque autre utilisateur est affecté à une ou plusieurs boutiques. Sans affectation, il n'a accès à aucune boutique. Son rôle s'applique de la même façon dans chacune.
- Un utilisateur **inactif** ne peut pas se connecter ; ses sessions et jetons sont révoqués.
- Sans la permission `records.view_all`, un utilisateur ne voit que les opérations qu'il a enregistrées.
- Les permissions sont contrôlées **côté serveur** sur chaque endpoint. Le menu, les cartes et les actions rapides n'affichent que ce qui est autorisé. Une page refusée affiche « Vous n'avez pas accès à cette page ».
- Toute modification de rôle ou de permission est journalisée.
- Le super-admin plateforme est un compte distinct, sans espace (ADR-010).

### 6.3 Permissions

Liste fixe, non modifiable par les commerçants. Les permissions d'espace portent sur les données communes (catalogue, clients, paramètres) ; les permissions de boutique s'exercent uniquement dans les boutiques auxquelles l'utilisateur est affecté.

| Niveau | Domaine | Permissions |
|---|---|---|
| Espace | Abonnement | `subscription.manage` |
| Espace | Boutiques | `shops.manage` |
| Espace | Utilisateurs et rôles | `users.manage`, `roles.manage` |
| Espace | Paramètres | `settings.manage`, `payment_settings.manage` |
| Espace | Catalogue | `products.view`, `products.create`, `products.update`, `products.disable`, `categories.manage`, `units.manage` |
| Espace | Clients | `customers.view`, `customers.create`, `customers.update` |
| Espace | Fournisseurs | `suppliers.view`, `suppliers.manage` |
| Boutique | Général | `dashboard.view`, `records.view_all`, `audit.view` |
| Boutique | Ventes | `sales.create`, `sales.view`, `sales.cancel`, `sales.edit_price`, `sales.give_discount` |
| Boutique | Crédits | `credits.view`, `credits.create`, `credits.cancel`, `credits.opening_balance`, `repayments.create`, `repayments.cancel` |
| Boutique | Stock | `stock.view`, `stock.entry`, `stock.exit`, `stock.adjust` |
| Boutique | Approvisionnements | `purchases.view`, `purchases.create`, `purchases.cancel`, `purchase_payments.create` |
| Boutique | Dépenses | `expenses.view`, `expenses.create`, `expenses.cancel` |

### 6.4 Rôles

**Un seul rôle prédéfini :**

| Rôle | Permissions | Modifiable | Supprimable |
|---|---|---|---|
| Owner | Toutes, dans toutes les boutiques | Non | Non |

**Tous les autres rôles sont créés par le propriétaire.** Il choisit le nom (par exemple « Vendeur », « Caissière du soir », « Gérant Yopougon ») et coche les permissions dans la liste du §6.3. Il peut ensuite modifier les permissions du rôle à tout moment ; le changement s'applique immédiatement à tous les utilisateurs qui ont ce rôle.

Pour faciliter la prise en main, l'écran de création de rôle peut proposer des **exemples de configuration** (vendeur, caissier, gestionnaire de stock) que le propriétaire applique en un clic puis ajuste. Ce ne sont pas des rôles créés d'avance : rien n'est enregistré tant que le propriétaire ne valide pas.

---

## 7. Règles de gestion transverses

### 7.1 Règles fondamentales

1. Une vente validée diminue le stock de la boutique, qu'elle soit payée ou à crédit.
2. Une vente peut être payée immédiatement, partiellement ou entièrement à crédit, en un ou plusieurs modes de paiement.
3. Une vente avec un reste à payer doit être associée à un client identifiable.
4. Un client peut avoir plusieurs crédits ; un crédit peut être remboursé en plusieurs fois ; un remboursement peut couvrir plusieurs crédits.
5. Un remboursement augmente l'argent reçu mais ne crée pas de vente et ne modifie pas le stock.
6. Les soldes sont toujours calculés par le système.
7. Une opération financière validée n'est jamais supprimée ; elle est annulée ou régularisée avec un motif (ADR-012).
8. Les données d'un espace ne sont jamais accessibles aux autres espaces ; les données d'une boutique ne sont accessibles qu'aux utilisateurs affectés.
9. Les indicateurs sont calculés à partir des données réelles.

### 7.2 Stock

- Le stock est tenu par **(produit, variante, boutique)** dans `shop_stock.quantity`, toujours **exprimé dans l'unité de base**.
- Chaque variation crée une ligne dans `stock_movements`. La quantité de `shop_stock` est égale à la somme des mouvements.
- Les services ne gèrent pas de stock.

| Opération | Effet |
|---|---|
| Vente validée (payée ou à crédit) | − |
| Annulation de vente | + (restitution) |
| Approvisionnement reçu | + |
| Annulation d'approvisionnement | − |
| Entrée manuelle | + |
| Sortie manuelle, avec un motif choisi dans une liste : périmé, cassé, volé, consommé, autre (§7.11) | − |
| Ajustement d'inventaire | + ou − (écart) |
| Remboursement de crédit | aucun |

- La création d'un produit crée une ligne de stock à 0 dans chaque boutique ; la création d'une boutique crée une ligne à 0 pour chaque produit.
- **Le stock ne peut jamais devenir négatif** (décision P1, §17). Toute opération qui ferait passer `shop_stock.quantity` sous 0 est refusée par le serveur (`422`, message en français simple, ex. « Stock insuffisant : il reste 3 unités de Riz 5 kg ») : vente, sortie manuelle, annulation d'approvisionnement. Le contrôle est fait dans la transaction, avec verrouillage de la ligne `shop_stock`, pour être sûr en concurrence. Le POS empêche d'ajouter au panier une quantité supérieure au stock disponible.
- Pour un produit dont les dates de péremption sont suivies, le stock de chaque boutique est en plus découpé par arrivage et par date (§7.11).

### 7.3 Unités

- Unités proposées par défaut : unité, paquet, carton, bouteille, sachet, kilogramme, gramme, litre.
- Une unité dérivée a une unité de base, un opérateur (`*` ou `/`) et une valeur. Exemple : Carton = Unité × 12.
- Quantité en unité de base = `quantité × valeur` (opérateur `*`) ou `quantité ÷ valeur` (opérateur `/`).
- Un produit a une unité de base et, en option avancée, une unité de vente et une unité d'achat.

### 7.4 Montants d'une vente ou d'un approvisionnement

Tous les montants sont **recalculés par le serveur** ; ceux envoyés par le navigateur sont ignorés.

**Par ligne**
- Remise : `percent` (pourcentage du prix unitaire) ou `fixed` (montant par unité).
- `prix_remisé = prix − remise`.
- Taxe (option avancée, désactivée par défaut) :
  - exclusive : `taxe = prix_remisé × taux` ; `prix_net = prix_remisé` ;
  - inclusive : `taxe = prix_remisé × taux / (1 + taux)` ; `prix_net = prix_remisé − taxe`.
- `sous-total = quantité × (prix_net + taxe)`.

**Par document**
- `total_lignes = Σ sous-totaux`.
- `taxe_globale = (total_lignes − remise_globale) × taux_global`.
- `total = total_lignes − remise_globale + taxe_globale`.
- Calcul à 2 décimales ; affichage FCFA sans décimales (`15 000 FCFA`).

### 7.5 Paiement d'une vente et crédit

- Au moment de la vente : `payé_immédiatement = Σ paiements saisis` (espèces, Mobile Money, carte…).
- **Montant à crédit = total de la vente − payé immédiatement.**
- Si le montant à crédit est supérieur à 0, un **crédit client** est créé automatiquement, rattaché à la vente, au client et à la boutique.
- Le rendu monnaie est calculé sur les espèces uniquement et n'est jamais compté comme argent reçu.
- Statut de paiement de la vente : `paid` (reste = 0), `partial` (0 < reste < total), `credit` (rien payé, tout à crédit).

### 7.6 Crédits et remboursements

- **Reste d'un crédit = montant du crédit − Σ affectations de remboursements − Σ régularisations.**
- **Solde d'un client = Σ restes de ses crédits ouverts** (par boutique et total).
- Un remboursement a un montant reçu et une ou plusieurs **affectations** à des crédits. La somme des affectations ne dépasse jamais le montant reçu.
- Par défaut, l'affectation proposée va du crédit le plus ancien au plus récent ; le commerçant peut la modifier.
- États d'un crédit :

| État | Code | Condition |
|---|---|---|
| En cours | `open` | Rien n'a été remboursé |
| Partiellement remboursé | `partial` | 0 < remboursé < montant |
| Soldé | `settled` | Reste = 0 |
| Annulé | `cancelled` | Annulé par une opération autorisée, avec motif |

- **Solde initial** : lors de la mise en place, une dette existante peut être saisie sans vente, marquée « solde initial » (permission `credits.opening_balance`).
- Annuler un remboursement libère ses affectations et recalcule les restes.
- **Annuler une vente à crédit déjà en partie remboursée** (décision P3, §17) : le crédit est annulé ; l'argent déjà reçu sur ce crédit n'est jamais perdu. Au moment de l'annulation, le commerçant choisit pour ce montant :
  - **le garder en avoir** : GStock enregistre un **avoir** au nom du client (somme due par la boutique au client), utilisable pour payer un prochain achat ou une autre de ses dettes ;
  - **le rendre au client** : GStock enregistre un **remboursement au client** (sortie d'argent, mode de paiement, motif), qui diminue l'argent reçu de la période.
  L'opération est journalisée (ADR-012) ; le motif d'annulation reste obligatoire.

### 7.7 Échéances (paiement échelonné)

- Un crédit client, ou le reste dû d'un approvisionnement fournisseur, peut recevoir un **échéancier** facultatif : des échéances avec montant, date et statut.
- La somme des échéances est égale au reste dû au moment de la création.
- Les affectations de remboursement soldent les échéances de la plus ancienne à la plus récente.
- Statuts : `pending`, `partial`, `paid`, `overdue`. Une tâche quotidienne passe en `overdue` les échéances dépassées non soldées.
- Les échéances déjà payées ne sont pas modifiables.
- Aucune relance n'est envoyée automatiquement au client : GStock affiche les échéances en retard au commerçant, qui décide.

### 7.8 Distinction financière

GStock distingue toujours, dans le tableau de bord et les rapports :

| Indicateur | Contenu |
|---|---|
| Ventes totales | Total des ventes validées (payées ou à crédit) |
| Ventes payées immédiatement | Part payée au moment de la vente |
| Ventes à crédit | Montants mis à crédit |
| Remboursements reçus | Argent reçu sur des crédits |
| Argent reçu | Payé immédiatement + remboursements reçus |
| Dépenses | Total des dépenses |
| Reste à récupérer | Σ des soldes clients |
| Résultat estimé | Ventes totales − coût d'achat des produits vendus − dépenses (si les prix d'achat sont renseignés) |
| Pertes | Valeur, au prix d'achat, des produits sortis du stock comme périmés, cassés ou volés (§7.11) |

Une vente à crédit est une vente mais pas un encaissement. Un remboursement est un encaissement mais pas une vente. Une perte n'est ni une dépense ni une sortie d'argent : l'argent est sorti à l'achat de la marchandise. Elle est affichée sur une ligne distincte et n'est pas déduite du résultat estimé.

### 7.9 Références automatiques

- Format `PRÉFIXE-N`, numérotation **par espace**, générée par une séquence atomique (table `document_sequences` verrouillée en transaction) : aucun doublon possible en concurrence.

| Document | Préfixe |
|---|---|
| Vente | `V-` |
| Crédit (solde initial) | `CR-` |
| Remboursement | `RB-` |
| Approvisionnement | `AP-` |
| Mouvement de stock manuel | `MS-` |
| Dépense | `DP-` |

### 7.10 Dates et fuseau

- Chaque opération a une **date métier** (date et heure de l'opération), distincte de sa date d'enregistrement (utile pour les opérations hors ligne).
- Fuseau horaire paramétrable par espace (défaut : `Africa/Abidjan`).

### 7.11 Dates de péremption

GStock suit les dates de péremption **par arrivage**, sans numéro de lot du fabricant. La fonction est accessible à tous, sans le mode avancé, et **tous ses champs sont facultatifs**.

**Activation par produit**
- Chaque produit stocké a un interrupteur « Suivre les dates de péremption » (`track_expiry`), **désactivé par défaut**. Un service ne l'a jamais. Pour un produit à variantes, il s'applique à toutes les variantes.
- Le délai d'alerte « Prévenir X jours avant » est réglable par produit ; à défaut, le délai de l'espace s'applique (7 jours par défaut).
- À l'activation, le stock déjà présent dans chaque boutique devient un arrivage **sans date**. À la désactivation, les arrivages sont gardés dans l'historique mais ne sont plus tenus ni affichés.

**Arrivages**
- Pour un produit suivi, chaque entrée de marchandise crée un **arrivage** (`stock_lots`) dans la boutique : quantité initiale (à la création du produit), entrée de stock, approvisionnement, ajustement d'inventaire positif.
- La **date de péremption est facultative** à chaque entrée. Sans date, l'arrivage est « sans date » ; sa date peut être renseignée plus tard (permission `stock.adjust`, action journalisée).
- Un arrivage contenant deux dates se saisit en deux lignes.
- La somme des quantités restantes des arrivages d'un (produit, variante, boutique) est **toujours égale** à `shop_stock.quantity`. Aucun arrivage ne devient négatif.

**Sorties**
- Une vente, une sortie manuelle ou un ajustement d'inventaire négatif puise automatiquement dans les arrivages, dans cet ordre : **dates les plus proches d'abord**, puis les arrivages sans date ; à date égale, le plus ancien arrivage d'abord. Le vendeur ne choisit jamais d'arrivage à la caisse.
- Chaque sortie garde la trace des arrivages où elle a puisé (`stock_lot_movements`). Son annulation remet chaque quantité dans son arrivage d'origine.
- **Retirer les produits périmés** : sortie de stock avec le motif « Périmé », qui vise un arrivage précis (proposé depuis l'alerte). Sa valeur au prix d'achat compte dans les **Pertes** (§7.8).
- **Motif d'une sortie manuelle** : choisi dans une liste (`exit_reason`) : Périmé (`expired`), Cassé (`damaged`), Volé (`stolen`), Consommé (`consumed`, usage de la boutique ou du commerçant), Autre (`other`), avec une précision écrite facultative. Ce motif vaut pour tous les produits, suivis ou non. Seuls Périmé, Cassé et Volé comptent dans les **Pertes** (§7.8).

**Annulation d'un approvisionnement**
- Elle retire du stock les quantités de **ses propres arrivages**. Si une partie de ces arrivages a déjà été vendue ou sortie, l'annulation est **refusée** (`422`, ex. « 15 Yaourt nature de cet approvisionnement sont déjà vendus. Corrigez le stock par un inventaire. »). Les dates de péremption restent ainsi toujours justes.

**Alertes**

| État d'un arrivage | Condition |
|---|---|
| Bientôt périmé | Date de péremption dans le délai d'alerte |
| Périmé | Date de péremption dépassée (le jour même compte comme périmé) |

- Tableau de bord : carte « Péremption » (produits bientôt périmés et périmés, quantité et valeur), qui ouvre « Mon stock » filtré.
- « Mon stock » : filtres « Bientôt périmés » et « Périmés » ; la fiche produit détaille le stock par date (ex. « 12 pce au 20/11, 30 pce au 15/12, 5 pce sans date »).
- **À la caisse** : quand un produit qui a une quantité périmée dans la boutique est scanné ou ajouté au panier, une **alerte** s'affiche (ex. « Attention : 3 pce de Yaourt nature sont périmés depuis le 02/11 »). La vente reste possible ; le commerçant décide. L'alerte fonctionne aussi hors ligne, à partir des informations de péremption du cache de la caisse.
- Aucune alerte n'est envoyée automatiquement en dehors de l'application (voir P13, §17).

---

## 8. Modèle de données

**Conventions.**
- Toutes les tables ont `id`, `created_at`, `updated_at`. Les tables d'espace ont `tenant_id` (omis ci-dessous).
- Montants en `NUMERIC(15,2)`, quantités en `NUMERIC(15,3)`.
- Référentiels (produits, clients, catégories…) : suppression logique `deleted_at` ou désactivation `is_active`.
- Opérations financières (ventes, paiements, crédits, remboursements, approvisionnements, dépenses) : jamais supprimées ; colonnes `status`, `cancelled_at`, `cancelled_by`, `cancel_reason` (ADR-012).
- Opérations faisables hors ligne : colonne `offline_uuid` unique.

### 8.1 Plateforme SaaS (sans `tenant_id`)

| Table | Colonnes principales |
|---|---|
| `tenants` | name, slug (sous-domaine), owner_email, phone, currency_code, timezone, status (`trial`, `active`, `suspended`, `cancelled`), activated_at, first_sale_at |
| `plans` | name, price, billing_period (`monthly`, `yearly`), max_shops, max_users, max_products, trial_days, is_active |
| `tenant_subscriptions` | tenant_id, plan_id, starts_at, ends_at, trial_ends_at, status (`trial`, `active`, `past_due`, `cancelled`) |
| `tenant_invoices` | tenant_id, tenant_subscription_id, reference, amount, status (`pending`, `paid`, `failed`), geniuspay_transaction_id, paid_at |
| `platform_admins` | name, email, password, is_active |
| `platform_audit_logs` | platform_admin_id, action, tenant_id, subject_type, subject_id, details (JSONB), ip |

### 8.2 Espace et boutiques

| Table | Colonnes principales |
|---|---|
| `tenant_settings` | logo, phone, email, address, receipt_footer, advanced_mode (variantes, taxes, unités multiples), default_payment_method_id, expiry_alert_days (délai d'alerte de péremption, 7 par défaut) |
| `tenant_payment_settings` | provider (`geniuspay`), api_key, api_secret, webhook_secret (chiffrés), is_sandbox, is_active |
| `shops` | name, city, district, address, phone, receipt_note, receipt_show_customer, receipt_show_phone, auto_print_receipt, default_customer_id, is_active |
| `document_sequences` | document_type, next_number |

### 8.3 Utilisateurs, rôles, permissions

| Table | Colonnes principales |
|---|---|
| `users` | firstname, lastname, email (unique par espace), phone, password, avatar, role_id, is_active, last_login_at |
| `roles` | name, description, is_owner (vrai uniquement pour le rôle Owner, protégé) |
| `permissions` | name, label, level (`tenant`, `shop`), group — table globale sans `tenant_id`, remplie par migration, non modifiable |
| `permission_role` | permission_id, role_id |
| `shop_user` | shop_id, user_id — boutiques auxquelles l'utilisateur est affecté |
| `audit_logs` | shop_id, user_id, action, subject_type, subject_id, old_values (JSONB), new_values (JSONB), reason, ip |

### 8.4 Catalogue et stock

| Table | Colonnes principales |
|---|---|
| `categories` | name, color |
| `brands` | name (option avancée) |
| `units` | name, short_name, base_unit_id, operator (`*`, `/`), operator_value |
| `products` | type (`simple`, `variable`, `service`), name, code (unique par espace, généré si vide), barcode, category_id, brand_id, unit_id, sale_unit_id, purchase_unit_id, cost, price, tax_rate, tax_method, stock_alert, image, is_active, track_expiry, expiry_alert_days (facultatif) |
| `product_variants` | product_id, name, code, barcode, cost, price, is_active |
| `shop_stock` | shop_id, product_id, product_variant_id, quantity, stock_alert (surcharge du seuil par boutique, facultatif) |
| `stock_movements` | shop_id, product_id, product_variant_id, quantity (signée), unit_cost, source_type, source_id, user_id, occurred_at |
| `stock_lots` | shop_id, product_id, product_variant_id, expiry_date (facultative), initial_quantity, quantity (restante, jamais négative), unit_cost, source_type, source_id (entrée d'origine), received_at |
| `stock_lot_movements` | stock_lot_id, stock_movement_id, quantity (signée) — répartition d'un mouvement sur les arrivages (§7.11) |
| `adjustments` | shop_id, reference, kind (`entry`, `exit`, `inventory`), exit_reason (`expired`, `damaged`, `stolen`, `consumed`, `other`), reason, occurred_at, user_id, status, offline_uuid |
| `adjustment_items` | adjustment_id, product_id, product_variant_id, quantity, counted_quantity (inventaire), expiry_date (entrée, facultative), stock_lot_id (sortie d'un arrivage précis, facultatif) |

### 8.5 Ventes et paiements

| Table | Colonnes principales |
|---|---|
| `customers` | name, phone, district, note, is_active |
| `payment_methods` | name, type (`cash`, `mobile_money`, `card`, `other`), uses_geniuspay, is_active |
| `sales` | shop_id, reference, offline_uuid, occurred_at, customer_id, user_id, subtotal, discount, tax_amount, total, paid_now, credit_amount, payment_status (`paid`, `partial`, `credit`), status (`draft`, `completed`, `cancelled`), sync_status (`ok`, `to_review`), note |
| `sale_items` | sale_id, product_id, product_variant_id, unit_id, quantity, base_quantity, price, unit_cost, discount, discount_method, tax_rate, tax_method, tax_amount, subtotal |
| `sale_payments` | sale_id, payment_method_id, amount, cash_given, change, geniuspay_transaction_id, status (`pending`, `completed`, `failed`, `cancelled`) |

### 8.6 Crédits clients

| Table | Colonnes principales |
|---|---|
| `customer_credits` | shop_id, customer_id, sale_id (vide si solde initial), reference, occurred_at, amount, remaining_amount, is_opening_balance, status (`open`, `partial`, `settled`, `cancelled`), user_id |
| `credit_repayments` | shop_id, customer_id, reference, offline_uuid, received_at, amount, payment_method_id, geniuspay_transaction_id, user_id, note, status (`completed`, `pending`, `cancelled`) |
| `credit_repayment_allocations` | credit_repayment_id, customer_credit_id, amount |
| `credit_adjustments` | customer_credit_id, amount (signé), reason, user_id |
| `installments` | payable_type (`customer_credit`, `purchase`), payable_id, due_date, amount, paid_amount, status (`pending`, `partial`, `paid`, `overdue`) |

### 8.7 Approvisionnements et dépenses

| Table | Colonnes principales |
|---|---|
| `suppliers` | name, phone, address, note, is_active |
| `purchases` | shop_id, supplier_id (facultatif), reference, occurred_at, subtotal, discount, tax_amount, total, paid_amount, payment_status (`paid`, `partial`, `unpaid`), status (`received`, `cancelled`), user_id, note |
| `purchase_items` | purchase_id, product_id, product_variant_id, unit_id, quantity, base_quantity, cost, discount, discount_method, tax_rate, tax_method, tax_amount, subtotal, expiry_date (facultative, produits suivis) |
| `purchase_payments` | purchase_id, payment_method_id, amount, paid_at, user_id, note, status |
| `expense_categories` | name (par défaut : Transport, Électricité, Loyer, Internet, Personnel, Autres dépenses) |
| `expenses` | shop_id, reference, offline_uuid, occurred_at, expense_category_id, amount, payment_method_id, note, user_id, status |

### 8.8 Tables de la phase 2 (prévues)

`cash_sessions` (ouverture / clôture de caisse), `cash_movements`, `incomes` (recettes hors ventes), `sale_returns` et `sale_return_items`, `stock_transfers` et `stock_transfer_items`, `stock_counts` (inventaires), `shop_product_prices` (prix par boutique, si validé).

### 8.9 Relations principales

- `tenants` 1–N `shops`, `users`, `roles`, `products`, `customers`, `suppliers`.
- `users` N–1 `roles` ; `users` N–N `shops` via `shop_user`.
- `roles` N–N `permissions` via `permission_role`.
- `products` → `categories`, `brands`, `units` ; `product_variants` → `products` ; `shop_stock` relie produit / variante et boutique.
- `stock_lots` → `shops`, `products`, `product_variants` ; `stock_lot_movements` relie arrivages et mouvements de stock.
- `sales` → `shops`, `customers`, `users` ; `sale_items` et `sale_payments` → `sales`.
- `customer_credits` → `customers`, `shops`, `sales` (facultatif).
- `credit_repayments` → `customers` ; `credit_repayment_allocations` relie remboursements et crédits.
- `installments` → `customer_credits` ou `purchases`.
- `purchases` → `shops`, `suppliers` ; `purchase_items` et `purchase_payments` → `purchases`.
- `expenses` → `shops`, `expense_categories`.

---

## 9. Conventions de l'API

- REST, JSON, préfixe `/api/v1`, champs en snake_case.
- L'espace est déterminé par le sous-domaine (ADR-009), jamais par un paramètre envoyé par le client.
- Ressources **d'espace** : `/api/v1/products`, `/api/v1/customers`, `/api/v1/roles`…
- Ressources **de boutique** : `/api/v1/shops/{shop_id}/sales`, `/api/v1/shops/{shop_id}/stock`… Le serveur vérifie l'affectation de l'utilisateur à la boutique et sa permission.
- **Listes** : `?page=1&per_page=20&search=...&sort=-occurred_at&filter[status]=completed`. Réponse :

```json
{
  "data": [],
  "meta": { "current_page": 1, "per_page": 20, "total": 0, "last_page": 1 }
}
```

- **Erreurs** : `401`, `403`, `404`, `409` (conflit, ex. opération déjà annulée), `422` validation :

```json
{
  "message": "Les informations saisies ne sont pas valides.",
  "errors": { "customer_id": ["Choisissez un client pour mettre à crédit."] }
}
```

- **Montants** sous forme de chaînes décimales (`"15000.00"`) ; **dates** en ISO 8601.
- **Annulation** : `POST /.../{id}/cancel` avec `{ "reason": "..." }` ; jamais de `DELETE` sur une opération financière.
- **Idempotence** : les créations faisables hors ligne acceptent un `offline_uuid` ; un second envoi renvoie l'opération déjà enregistrée.
- Documentation OpenAPI générée et tenue à jour, référence commune au front et au back.

---

## 10. Plan de conception module par module

Chaque fiche donne l'objectif, les fonctionnalités, les tables, les endpoints, les écrans et les critères d'acceptation. Les permissions sont celles du §6.3.

Convention : une **[LISTE]** propose recherche, filtres, tri et pagination serveur ; sur mobile, elle s'affiche en cartes.

### M00 — Plateforme SaaS

**Objectif.** Permettre à un commerçant de s'inscrire, de s'abonner et de démarrer sans aide.

**Fonctionnalités.**
- Inscription : nom de l'espace, sous-domaine, nom de la première boutique, nom, téléphone, e-mail et mot de passe du propriétaire, choix du plan.
- Provisionnement automatique : espace, propriétaire, première boutique, rôle Owner attribué au propriétaire, unités par défaut, modes de paiement (Espèces, Mobile Money, Carte), catégories de dépenses par défaut, séquences de références.
- Assistant de démarrage : ajouter ses premiers produits, saisir les dettes existantes (soldes initiaux), faire une première vente.
- Période d'essai, puis paiement de l'abonnement via GeniusPay (clés plateforme).
- Page « Mon abonnement » : plan, échéance, factures, changement de plan.
- Limites du plan (boutiques, utilisateurs, produits) avec message clair à l'atteinte.
- Suspension après un délai de grâce en cas d'impayé : l'espace passe en lecture seule.

**Tables.** `tenants`, `plans`, `tenant_subscriptions`, `tenant_invoices`.

**Endpoints.** `POST /register`, `GET /plans`, `GET /subscription`, `POST /subscription/checkout`, `GET /subscription/invoices`, `POST /webhooks/geniuspay/platform`.

**Écrans.** Inscription, choix du plan, assistant de démarrage, Mon abonnement, écran de suspension.

**Critères d'acceptation.**
- Une inscription crée un espace utilisable immédiatement sur son sous-domaine.
- Un paiement réussi (webhook) prolonge l'abonnement ; un échec ne le prolonge pas.
- Un espace suspendu ne peut plus enregistrer d'opération mais reste consultable.

### M01 — Back-office super-admin (Filament)

**Objectif.** Permettre à Genius Groups de superviser les commerçants, leurs boutiques et leurs utilisateurs.

**Fonctionnalités.**
- **Tableau de bord** (widgets Filament) : espaces inscrits, espaces activés (au moins un produit), espaces avec une première vente, utilisateurs actifs à J7 et J30, ventes enregistrées par espace, crédits et remboursements enregistrés, conversion essai → payant, churn, revenus d'abonnement du mois.
- **Espaces** : liste filtrable (statut, plan, date d'inscription, dernière activité), fiche avec coordonnées, abonnement, factures, boutiques, utilisateurs et indicateurs d'usage.
- **Boutiques** : liste de toutes les boutiques avec leur espace, ville, nombre d'utilisateurs, nombre de ventes et dernière activité.
- **Utilisateurs** : liste de tous les utilisateurs avec leur espace, leur rôle, leurs boutiques, statut et dernière connexion ; désactivation et réinitialisation du mot de passe.
- **Actions** : suspendre ou réactiver un espace, prolonger un essai, changer de plan manuellement.
- **Mode support** : se connecter en tant qu'un utilisateur, avec motif obligatoire, durée limitée et bandeau visible.
- **Plans** : création et modification des offres et limites.
- **Factures d'abonnement** : liste, statut, relance manuelle.
- **Journal** : toutes les actions des super-admins (`platform_audit_logs`).

**Tables.** `platform_admins`, `platform_audit_logs` ; lecture de toutes les tables d'espace.

**Écrans.** Panneau Filament sur `admin.gstock.app` : Tableau de bord, Espaces, Boutiques, Utilisateurs, Plans, Factures, Journal.

**Critères d'acceptation.**
- Seul un compte `platform_admins` actif accède au panneau.
- Chaque suspension, réactivation ou connexion en mode support est journalisée avec son auteur et son motif.
- Les indicateurs du tableau de bord correspondent aux données réelles.

### M02 — Authentification et profil

**Fonctionnalités.**
- Connexion par e-mail ou téléphone et mot de passe ; refus explicite si identifiants incorrects, compte inactif ou espace suspendu.
- Connexion centrale sur le domaine principal (ADR-009) : l'espace est trouvé à partir du compte, puis ouvert déjà connecté ; choix de l'espace si le compte existe dans plusieurs.
- Déconnexion ; mot de passe oublié par lien à jeton expirant.
- Profil : prénom, nom, téléphone, avatar, mot de passe.
- Au chargement : utilisateur, rôle et permissions, boutiques accessibles, paramètres de l'espace.
- Limitation du nombre de tentatives de connexion.

**Endpoints.** `POST /auth/login`, `POST /auth/central-login` (domaine principal : espaces du compte, chacun avec son lien de connexion à usage unique), `POST /auth/token-login`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /me`, `PUT /me`.

**Critères d'acceptation.** Un utilisateur inactif ne peut pas se connecter. `GET /me` renvoie les permissions et les boutiques utilisées par le menu et le sélecteur.

### M03 — Espace, boutiques et paramètres

**Fonctionnalités.**
- **Espace** : nom, logo, téléphone, e-mail, adresse, devise (FCFA / XOF), fuseau horaire, pied de reçu, mode avancé (variantes, taxes, unités multiples, marques).
- **Boutiques** [LISTE] : nom, ville, quartier, adresse, téléphone, client par défaut, paramètres du reçu (note, éléments affichés, impression automatique), active ou non. La création initialise le stock à 0 pour tous les produits.
- **Clés GeniusPay** : saisie, mode test, test de connexion ; clés masquées après enregistrement.

**Tables.** `tenants`, `tenant_settings`, `tenant_payment_settings`, `shops`.

**Endpoints.** `GET|PUT /settings`, `CRUD /shops` (sans suppression : désactivation), `GET|PUT /settings/payment`, `POST /settings/payment/test`.

**Critères d'acceptation.** Une clé GeniusPay n'est jamais renvoyée en clair. Le nombre de boutiques respecte la limite du plan. Une boutique désactivée n'apparaît plus dans le sélecteur.

### M04 — Utilisateurs, rôles et permissions

**Fonctionnalités.**
- **Rôles** [LISTE] : création libre par le propriétaire (nom, description), grille des permissions prédéfinies groupées par domaine avec « tout cocher » par groupe, exemples de configuration applicables en un clic. Le rôle Owner est affiché en lecture seule. Un rôle attribué à un utilisateur ne peut pas être supprimé.
- **Utilisateurs** [LISTE] : création, modification, activation / désactivation ; **un seul rôle** (choisi parmi les rôles créés) ; affectation à une ou plusieurs boutiques.
- **Permissions** : consultables (liste et description) mais ni créées, ni modifiées, ni supprimées.
- Vue « Qui a accès à cette boutique ? » depuis la fiche boutique.

**Tables.** `users`, `roles`, `permissions`, `permission_role`, `shop_user`.

**Endpoints.** `CRUD /users`, `PATCH /users/{id}/status`, `PUT /users/{id}/shops` (affectations), `CRUD /roles` (refusé sur Owner), `GET /permissions` (lecture seule).

**Critères d'acceptation.**
- Un endpoint refuse l'action (403) si le rôle n'a pas la permission ou si l'utilisateur n'est pas affecté à la boutique, même appelé directement.
- Toute tentative de modifier ou supprimer le rôle Owner ou une permission est refusée.
- Modifier les permissions d'un rôle s'applique immédiatement à tous ses utilisateurs.
- Un vendeur de la boutique A ne voit aucune donnée de la boutique B.
- Toute modification de rôle ou d'affectation est journalisée.

### M05 — Référentiels

**Fonctionnalités.** Catégories de produits (nom, couleur), unités (§7.3), modes de paiement (nom, type, GeniusPay ou non), catégories de dépenses, marques (mode avancé). Un élément utilisé peut être désactivé, pas supprimé.

**Endpoints.** `CRUD /categories`, `CRUD /units`, `CRUD /payment-methods`, `CRUD /expense-categories`, `CRUD /brands`.

### M06 — Mes produits

**Objectif.** Créer et retrouver facilement les produits vendus.

**Fonctionnalités.**
- Liste [LISTE] : recherche par nom, code ou code-barres ; filtre par catégorie ; colonnes image, nom, catégorie, prix de vente, quantité dans la boutique courante, état du stock.
- Création rapide avec **seulement le nom et le prix de vente obligatoires** ; facultatifs : catégorie, prix d'achat, unité, code-barres, seuil d'alerte, image, quantité initiale dans la boutique courante.
- Suivi des dates de péremption (§7.11), accessible sans le mode avancé : interrupteur « Suivre les dates de péremption » et délai d'alerte, facultatifs ; date de péremption facultative à côté de la quantité initiale ; la fiche affiche le stock par date.
- Mode avancé : type (simple, variable, service), variantes, marque, unités de vente et d'achat, taxe.
- Modifier, désactiver ; scan du code-barres par la caméra.
- Le catalogue est commun à toutes les boutiques ; la fiche affiche le stock par boutique.

**Tables.** `products`, `product_variants`, `shop_stock`.

**Endpoints.** `CRUD /products` (désactivation au lieu de suppression), `GET /products/{id}/stock`, `GET /shops/{shop_id}/products/search?q=` (nom, code ou code-barres ; renvoie prix, unité et stock de la boutique).

**Critères d'acceptation.** Un produit peut être créé en moins de 30 secondes sur mobile. La création crée une ligne de stock à 0 dans chaque boutique. Un service n'a jamais de stock.

### M07 — Mon stock

**Objectif.** Donner une visibilité simple sur les quantités disponibles, boutique par boutique.

**Fonctionnalités.**
- Vue du stock [LISTE] : produit, quantité, seuil, prix d'achat, valeur estimée, état (`ok`, `faible`, `rupture`).
- Entrée de stock, sortie de stock (perte, casse, consommation), ajustement manuel avec motif ; référence `MS-xxxx`.
- Historique des mouvements d'un produit.
- Alertes de stock faible et de rupture.
- Vue « Toutes mes boutiques » pour le propriétaire.
- Dates de péremption (§7.11) : date facultative à chaque entrée d'un produit suivi ; filtres « Bientôt périmés » et « Périmés » ; stock par date d'un produit ; date d'un arrivage renseignée ou corrigée ; sortie « Périmé » d'un arrivage précis.

**Tables.** `shop_stock`, `stock_movements`, `stock_lots`, `stock_lot_movements`, `adjustments`, `adjustment_items`.

**Endpoints.** `GET /shops/{shop_id}/stock` (avec `filter[expiry]=soon|expired`), `GET /shops/{shop_id}/stock/alerts`, `GET /shops/{shop_id}/stock/movements?product_id=`, `GET /shops/{shop_id}/stock/lots?product_id=`, `PUT /shops/{shop_id}/stock/lots/{id}` (date de péremption), `POST /shops/{shop_id}/adjustments` (avec `exit_reason`, et par ligne `expiry_date` ou `stock_lot_id`), `POST /shops/{shop_id}/adjustments/{id}/cancel`.

**Critères d'acceptation.** Après chaque opération, `shop_stock.quantity` est égal à la somme des mouvements et n'est jamais négatif. Toute opération de stock est transactionnelle. Pour un produit suivi, la somme des arrivages est égale à `shop_stock.quantity`, et une vente puise d'abord dans la date la plus proche.

### M08 — Ventes / Point de vente (POS)

**Objectif.** Enregistrer une vente en quelques secondes, payée immédiatement, en partie ou à crédit.

**Fonctionnalités.**
- Écran de vente plein écran : recherche par nom ou scan, catégories, grille de produits avec prix, panier (quantité, remise selon permission), total en direct, sélection du client si nécessaire.
- Boutons **« Encaisser »** et **« Mettre à crédit »** visibles dans le parcours.
- Modes de paiement : espèces (avec rendu monnaie), Mobile Money / carte via GeniusPay si configuré, **paiement mixte**, **à crédit**, **partiellement payé**.
- Vente sans fiche client si elle est entièrement payée ; client obligatoire dès qu'il reste un montant à crédit, avec **création rapide** (nom, téléphone facultatif).
- Mise en attente du panier (brouillon) et reprise.
- Reçu : impression (58 / 80 mm) ou partage WhatsApp (ADR-013).
- Historique des ventes [LISTE] : filtres période, client, vendeur, statut de paiement ; détail d'une vente.
- Annulation d'une vente avec motif (permission `sales.cancel`) : restitution du stock, annulation du crédit associé.
- **Alerte de péremption** (§7.11) : un produit qui a une quantité périmée dans la boutique déclenche une alerte quand il est scanné ou ajouté au panier ; la vente reste possible. `pos/bootstrap` fournit pour cela les informations de péremption de chaque produit.
- **Mode hors ligne** (ADR-005) : indicateur de connexion, file des opérations à synchroniser, synchronisation automatique, liste des opérations « à vérifier ».

**Tables.** `sales`, `sale_items`, `sale_payments`, `customer_credits`.

**Endpoints.** `GET /shops/{shop_id}/pos/bootstrap` (catalogue, prix, stock, clients, soldes, modes de paiement pour le cache), `POST /shops/{shop_id}/sales`, `GET /shops/{shop_id}/sales`, `GET /shops/{shop_id}/sales/{id}`, `POST /shops/{shop_id}/sales/{id}/cancel`, `GET /shops/{shop_id}/sales/{id}/receipt`, `POST /shops/{shop_id}/sales/{id}/share-link`, `POST /shops/{shop_id}/sync`, `POST /webhooks/geniuspay/{tenant}`.

**Critères d'acceptation.**
- Ajout d'un produit au panier en moins de 200 ms ; vente simple en espèces en moins de 15 secondes.
- Le stock diminue dès la validation, que la vente soit payée ou à crédit.
- Une vente partiellement payée crée un crédit égal au reste.
- Une vente hors ligne apparaît une seule fois après synchronisation, même si l'envoi est répété.
- La caisse reste utilisable après rechargement de la page sans réseau.

### M09 — Mes crédits clients

**Objectif.** Savoir précisément qui doit combien, pour quels achats, ce qui a été remboursé et ce qui reste à récupérer.

**Périmètre.** GStock enregistre et suit les crédits accordés par le commerçant. Il ne décide jamais d'accorder un crédit, ne note pas les clients et ne relance pas automatiquement.

**Fonctionnalités.**
- **Cartes interactives** : Total restant à récupérer, Clients qui me doivent, Nouveaux crédits (période), Remboursements reçus (période). Chaque carte ouvre la liste correspondante.
- **Liste des clients débiteurs** [LISTE] : nom, téléphone, total des crédits, déjà remboursé, solde restant, date de la dernière opération ; recherche par nom ou numéro, filtre et tri par solde.
- **Fiche crédit du client** : total à crédit, total remboursé, solde (par boutique et total), liste des crédits avec leur origine (vente et articles), historique des remboursements, historique des corrections et annulations.
- **Solde initial** : saisie d'une dette existante lors de la mise en place, marquée « solde initial ».
- **Remboursement** depuis la fiche client : montant reçu, date et heure, mode de paiement (espèces, Mobile Money via GeniusPay…), note ; partiel ou total.
- **Remboursement de plusieurs dettes** : affichage des crédits ouverts, affectation proposée du plus ancien au plus récent, modifiable ; la somme affectée ne dépasse jamais le montant reçu.
- **Échéancier** facultatif sur un crédit (§7.7) ; vue des échéances en retard et à venir.
- **Reçu de remboursement** : nom de la boutique, client, montant reçu, date, mode de paiement, solde restant, référence `RB-xxxx` ; impression ou partage WhatsApp après vérification.
- **Annulation** d'un crédit ou d'un remboursement avec motif ; régularisation d'un crédit (geste commercial, erreur de saisie) avec motif.

**Tables.** `customer_credits`, `credit_repayments`, `credit_repayment_allocations`, `credit_adjustments`, `installments`.

**Endpoints.** `GET /shops/{shop_id}/credits/summary?from=&to=`, `GET /shops/{shop_id}/credits/debtors`, `GET /customers/{id}/credits`, `POST /shops/{shop_id}/credits/opening-balance`, `POST /shops/{shop_id}/credits/{id}/cancel`, `POST /shops/{shop_id}/credits/{id}/adjustments`, `GET|PUT /shops/{shop_id}/credits/{id}/installments`, `POST /shops/{shop_id}/repayments`, `POST /shops/{shop_id}/repayments/{id}/cancel`, `GET /shops/{shop_id}/repayments/{id}/receipt`, `GET /shops/{shop_id}/installments?status=overdue`.

**Critères d'acceptation.**
- Une vente à crédit crée automatiquement le crédit, met à jour le solde du client et apparaît dans « Mes crédits clients ».
- Plusieurs remboursements successifs donnent le bon solde (exemple : 25 000 − 10 000 − 5 000 = 10 000 FCFA).
- Un remboursement peut être réparti sur plusieurs crédits.
- Aucune opération n'est supprimée ; toute correction est tracée avec son motif.
- Les cartes de synthèse reflètent les données réelles.
- Aucun scoring ni octroi automatique de crédit.

### M10 — Mes clients

**Fonctionnalités.**
- Clients [LISTE] : nom, téléphone facultatif, quartier facultatif, notes, date de création, solde restant.
- Création rapide depuis le POS (nom, téléphone facultatif).
- Fiche : historique des achats, historique des crédits, solde, bouton « Enregistrer un remboursement ».
- Collecte de données personnelles limitée au nécessaire.

**Tables.** `customers`.

**Endpoints.** `CRUD /customers` (désactivation au lieu de suppression), `GET /customers/{id}/summary`.

### M11 — Approvisionnements et fournisseurs

**Objectif.** Enregistrer rapidement les marchandises achetées et mettre le stock à jour.

**Fonctionnalités.**
- Approvisionnement : boutique, fournisseur facultatif, date, produits, quantités, prix d'achat, total ; référence `AP-xxxx`. Le stock augmente à l'enregistrement ; le prix d'achat du produit peut être mis à jour.
- Montant payé au fournisseur, reste dû, paiements ultérieurs ; échéancier facultatif.
- Date de péremption facultative par ligne, pour les produits suivis (§7.11).
- Historique des approvisionnements [LISTE] ; annulation avec motif (retrait du stock), refusée si une partie de ses arrivages a déjà été vendue ou sortie (§7.11).
- Fournisseurs [LISTE] : nom, téléphone, adresse, note ; total acheté, payé, dû.

**Tables.** `suppliers`, `purchases`, `purchase_items`, `purchase_payments`, `installments`.

**Endpoints.** `CRUD /suppliers`, `GET|POST /shops/{shop_id}/purchases`, `GET /shops/{shop_id}/purchases/{id}`, `POST /shops/{shop_id}/purchases/{id}/cancel`, `POST /shops/{shop_id}/purchases/{id}/payments`.

**Critères d'acceptation.** Un approvisionnement de 5 produits s'enregistre en moins d'une minute. Le stock augmente du bon nombre d'unités de base.

### M12 — Dépenses

**Fonctionnalités.** Enregistrer une dépense (catégorie, montant, mode de paiement, date, note), liste [LISTE] filtrable par période et catégorie, annulation avec motif. Faisable hors ligne. La caisse complète (ouverture, clôture, solde) arrive en phase 2.

**Tables.** `expense_categories`, `expenses`.

**Endpoints.** `GET|POST /shops/{shop_id}/expenses`, `POST /shops/{shop_id}/expenses/{id}/cancel`.

### M13 — Tableau de bord

**Objectif.** Répondre en un coup d'œil : combien ai-je vendu, combien ai-je reçu, que me reste-t-il, que dois-je racheter, combien me doit-on ?

**Fonctionnalités.**
- **Cartes interactives** (boutique courante ou toutes les boutiques pour le propriétaire) :

| Carte | Contenu | Au clic |
|---|---|---|
| Ventes du jour | Montant, nombre de ventes, comparaison avec la veille | Ventes du jour |
| Argent reçu | Total reçu, répartition par mode de paiement | Détail des encaissements |
| Stock faible | Nombre de produits sous le seuil | Produits à réapprovisionner |
| Crédits clients | Reste à récupérer, nombre de clients | Mes crédits clients |
| Dépenses | Total de la période | Liste des dépenses |
| Résultat estimé | Résultat si les prix d'achat sont renseignés | Détail du calcul |
| Péremption | Produits bientôt périmés et périmés (quantité, valeur) ; pertes de la période (§7.8) | Mon stock filtré |

- **Actions rapides** : Vendre, Ajouter un produit, Ajouter un client, Enregistrer un remboursement, Ajouter un approvisionnement, Enregistrer une dépense.
- **Activité récente** : ventes, ventes à crédit, remboursements, approvisionnements, dépenses, mouvements de stock ; chaque élément ouvre son détail.
- **Échéances** en retard et à venir (7 jours).
- Les cartes et actions affichées dépendent des permissions.

**Endpoints.** `GET /shops/{shop_id}/dashboard?period=today`, `GET /dashboard?period=today` (toutes les boutiques).

### M14 — Journal d'audit

**Fonctionnalités.** Journalisation automatique des actions sensibles : annulation de vente, modification de prix, mouvement de stock manuel, annulation ou régularisation de crédit, annulation de remboursement, modification des rôles, permissions et affectations, changement des clés de paiement. Consultation [LISTE] par le propriétaire (permission `audit.view`) : date, utilisateur, boutique, action, objet, motif, avant / après.

**Tables.** `audit_logs`.

**Endpoints.** `GET /audit-logs`.

### Modules de la phase 2 (rappel)

| Module | Contenu |
|---|---|
| Caisse | Ouverture avec fond de caisse, mouvements, clôture avec comptage et écart, solde de caisse par boutique |
| Recettes | Entrées d'argent hors ventes |
| Retours de marchandises | Retour en stock vendable ou sortie spécifique selon l'état du produit, remboursement ou avoir |
| Inventaire physique | Comptage, écarts, ajustement automatique |
| Transferts entre boutiques | Envoi, réception, mouvements des deux côtés |
| Rapports et statistiques | Ventes (jour, semaine, mois, top produits), stock (valeur, ruptures, mouvements), crédits (accordés, remboursés, restant, ancienneté, par client), finance (encaissements, dépenses, solde de caisse, marge) ; filtres par période et par boutique ; export PDF et Excel |
| Import / export | Import de produits et de clients (CSV), export du catalogue |

---

## 11. Organisation du frontend

### 11.1 Deux interfaces

| Interface | Technologie | Utilisateurs |
|---|---|---|
| Application commerçant | React (PWA), dépôt `gstock-web` | Propriétaires, gérants, vendeurs, caissiers, gestionnaires de stock |
| Back-office super-admin | Filament, dans l'application Laravel | Équipe Genius Groups |

### 11.2 Structure de l'application commerçant

```
gstock-web/
├── public/
├── src/
│   ├── app/              # routes, mises en page mobile et desktop, fournisseurs (Query, Auth, Boutique)
│   ├── components/       # composants partagés : cartes interactives, listes, formulaires, modales
│   ├── features/         # un dossier par module
│   │   ├── onboarding/   # inscription, assistant de démarrage, abonnement
│   │   ├── auth/
│   │   ├── shops/        # boutiques, sélecteur, paramètres
│   │   ├── users/        # utilisateurs, rôles, affectations
│   │   ├── products/
│   │   ├── stock/
│   │   ├── pos/
│   │   ├── sales/
│   │   ├── credits/
│   │   ├── customers/
│   │   ├── purchases/
│   │   ├── expenses/
│   │   ├── dashboard/
│   │   └── audit/
│   ├── lib/
│   │   ├── api/          # TOUS les appels réseau (voir ci-dessous)
│   │   │   ├── client.ts # seul endroit où fetch est appelé
│   │   │   ├── products.ts
│   │   │   ├── sales.ts
│   │   │   └── …         # un fichier par module, mêmes noms que features/
│   │   └── …             # formatage FCFA et dates, permissions, boutique courante
│   ├── offline/          # cache IndexedDB, file de synchronisation
│   ├── mocks/            # MSW : handlers et données JSON par module
│   ├── types/            # contrat d'API (types TypeScript)
│   └── locales/fr/       # textes de l'interface
└── package.json
```

Chaque dossier de `features/` contient ses pages, ses composants, ses hooks (TanStack Query) et ses schémas de validation. Il ne contient **aucun appel réseau**.

**Couche réseau centralisée (`src/lib/api/`).** Tous les appels HTTP vers l'API sont regroupés dans ce seul dossier, pour savoir immédiatement où intervenir si l'URL, l'authentification, la bibliothèque HTTP ou le format d'erreur changent.

- `client.ts` est le **seul fichier** qui appelle `fetch` (ou une autre bibliothèque HTTP). Il gère l'URL de base `/api/v1`, le jeton d'authentification, la sérialisation JSON et la conversion des erreurs (401, 403, 409, 422) en erreurs typées.
- Un fichier par module (`products.ts`, `sales.ts`, `credits.ts`…) expose des fonctions typées avec les types de `src/types/`, par exemple `getProducts(params)`, `createSale(shopId, payload)`, `cancelSale(shopId, saleId, reason)`. Ces fonctions ne contiennent que l'URL de l'endpoint et passent par `client.ts`.
- Les pages, composants, hooks et stores n'appellent **jamais** `fetch` ni n'écrivent d'URL d'API : ils importent les fonctions de `lib/api/`. Cette règle est vérifiée par le lint.
- Le code de `lib/api/` reste purement réseau : aucun composant ni hook React.

### 11.3 Données simulées

> Retirées le 5 novembre 2026 (clôture de l'ADR-004) : le même jeu de démonstration est créé par les seeders du backend. Le texte ci-dessous décrit la démarche suivie jusque-là.

- Les handlers MSW reproduisent les endpoints du §10 et les conventions du §9 (pagination, erreurs 403, 409, 422).
- Jeu de démonstration : un espace avec **2 boutiques** (Boutique Cocody, Boutique Yopougon), ~60 produits du quotidien (riz, huile, sucre, savon, boissons…), 30 clients dont 12 avec des crédits, 5 fournisseurs, 300 ventes dont une partie à crédit, des remboursements partiels, des échéances en retard, des dépenses.
- Cinq utilisateurs de démonstration : le propriétaire (rôle Owner) et quatre collaborateurs, chacun avec un rôle créé par le propriétaire dans le jeu de démonstration (Gérant, Vendeur, Caissier, Gestionnaire de stock) et affecté à une ou deux boutiques, pour tester menus, permissions et sélecteur de boutique.
- Les mocks appliquent les règles du §7 (totaux, stock, crédits, soldes).
- `VITE_USE_MOCKS=true` active MSW.

### 11.4 Phases du frontend

| Phase | Contenu | Livrable |
|---|---|---|
| F1 — Socle | Projet, mises en page mobile et desktop, composants cartes et listes, connexion simulée, permissions, sélecteur de boutique | Application navigable avec les 5 profils |
| F2 — Espace | Paramètres, boutiques, utilisateurs, rôles, référentiels | Configuration complète d'un espace |
| F3 — Produits et stock | Mes produits, Mon stock, mouvements | Catalogue et stock utilisables |
| F4 — Clients et ventes | Mes clients, POS en ligne, historique, reçus | Vente payée, mixte, à crédit |
| F5 — Crédits | Mes crédits clients, remboursements, affectations, échéances | Module crédit complet |
| F6 — Approvisionnements et dépenses | Approvisionnements, fournisseurs, dépenses | Entrées de stock et sorties d'argent |
| F7 — Tableau de bord et audit | Cartes, actions rapides, activité récente, journal | Tableau de bord réel |
| F8 — SaaS | Inscription, assistant de démarrage, abonnement | Parcours d'inscription complet |
| F9 — Hors ligne | PWA, cache, file de synchronisation | Vente sans réseau |

---

## 12. Exigences non fonctionnelles

### 12.1 Compatibilité

Application web responsive, navigateurs modernes, **optimisée pour smartphones Android d'entrée de gamme**, installable en PWA.

### 12.2 Sécurité

- Isolation stricte des espaces et des boutiques, vérifiée par des tests automatisés.
- Contrôle des permissions côté serveur sur chaque endpoint, et de l'affectation à la boutique.
- Mots de passe hachés (bcrypt) ; limitation du débit sur la connexion et la réinitialisation.
- Clés GeniusPay et secrets chiffrés en base, jamais renvoyés en clair ; webhooks vérifiés par signature.
- Reçus et documents accessibles uniquement par un utilisateur authentifié ou par un lien signé et expirant.
- Protection CSRF, XSS, injection SQL ; fichiers envoyés validés et stockés hors de la racine web ; HTTPS obligatoire.
- Journal d'audit des actions sensibles (commerçants et super-admins).
- Conformité à la loi ivoirienne sur la protection des données personnelles (autorité : ARTCI) ; collecte minimale de données sur les clients finaux.

### 12.3 Performance

- Première page utilisable en moins de 3 s sur une connexion 3G et un téléphone modeste.
- Listes paginées côté serveur, réponse en moins de 500 ms pour une boutique de 20 000 ventes.
- Tableau de bord en moins de 2 s.
- POS : ajout au panier en moins de 200 ms.

### 12.4 Hors ligne et synchronisation

- Consultation des produits, prix, stock et soldes clients déjà synchronisés.
- Enregistrement hors ligne des ventes (y compris à crédit), des remboursements en espèces et des dépenses.
- Synchronisation automatique au retour de la connexion, idempotente (`offline_uuid`).
- Conflits détectés et signalés, jamais perdus silencieusement ; soldes et stock recalculés par le serveur.

### 12.5 Fiabilité

- Toute opération touchant stock, paiements, crédits ou soldes est transactionnelle.
- Aucun double enregistrement de vente ou de remboursement (webhooks et synchronisation idempotents).
- Sauvegarde quotidienne de la base, avec rétention et restauration testée.

### 12.6 Qualité

- Tests automatisés sur les règles critiques : totaux, stock, crédits et affectations, échéances, permissions et affectations aux boutiques, isolation des espaces, synchronisation hors ligne.
- Intégration continue : lint, tests, build, image Docker.
- Documentation OpenAPI de l'API.

### 12.7 Exploitation

- Backend livré en image Docker, configuré par variables d'environnement.
- Ordonnanceur et workers actifs en production : échéances en retard, abonnements SaaS, sauvegardes, indicateurs du back-office.
- Logs sur stdout/stderr, point de santé `/health`, migrations automatiques au démarrage.

---

## 13. Critères d'acceptation produit

### 13.1 Simplicité
- Un nouvel utilisateur comprend les fonctions principales sans formation technique longue.
- Les actions quotidiennes sont accessibles en un ou deux gestes depuis le tableau de bord.
- Chaque carte interactive ouvre l'information ou l'action correspondante.
- Les erreurs sont explicites, en français simple, et récupérables.

### 13.2 POS
- Le boutiquier enregistre une vente ; le stock est mis à jour automatiquement.
- Paiement immédiat, mixte, partiel ou à crédit possible.
- La vente est historisée ; un reçu peut être imprimé ou partagé.

### 13.3 Crédits clients
- Une vente à crédit est associée à un client ; la dette est enregistrée automatiquement ; le stock diminue dès la validation ; le solde du client est mis à jour.
- Plusieurs remboursements successifs sont possibles ; le solde restant est calculé par le système.
- Un remboursement peut être affecté à plusieurs dettes.
- L'historique reste consultable ; les corrections sont tracées.
- Les cartes de synthèse reflètent les données réelles.
- Aucun scoring ni octroi automatique de crédit.

### 13.4 Plusieurs boutiques
- Le propriétaire crée plusieurs boutiques et passe de l'une à l'autre en un geste.
- Le propriétaire crée ses propres rôles à partir des permissions prédéfinies et attribue un rôle à chaque utilisateur.
- Un utilisateur ne voit que les boutiques auxquelles il est affecté.
- Le propriétaire voit une synthèse de toutes ses boutiques.

### 13.5 Responsive
- Utilisable sur smartphone, tablette et ordinateur ; actions principales accessibles sur mobile ; listes adaptées aux petits écrans ; composants utilisables au toucher.

### 13.6 Fiabilité
- Aucun double enregistrement ; aucun solde incohérent après une opération validée.
- Opérations hors ligne synchronisées sans perte silencieuse.
- Droits d'accès respectés ; opérations sensibles journalisées.

### 13.7 Super-admin
- Le super-admin consulte tous les espaces, leurs boutiques et leurs utilisateurs depuis Filament.
- Il peut suspendre, réactiver et changer le plan d'un espace ; chaque action est journalisée.

---

## 14. Indicateurs de réussite

La réussite se mesure à l'adoption réelle, pas au nombre de comptes créés. Ces indicateurs sont affichés dans le tableau de bord du back-office (M01).

| KPI | Mesure |
|---|---|
| Espaces inscrits | Acquisition |
| Espaces activés (premier produit ajouté) | Première utilisation réelle |
| Première vente enregistrée | Activation |
| Utilisateurs actifs à J7 | Adoption initiale |
| Utilisateurs actifs à J30 | Rétention |
| Ventes enregistrées par boutique | Utilisation du POS |
| Crédits enregistrés | Adoption du module crédit |
| Remboursements enregistrés | Utilisation du suivi des crédits |
| Espaces avec plusieurs boutiques | Adoption du multi-boutiques |
| Conversion essai → payant | Monétisation |
| Churn | Perte de clients |

**Indicateur stratégique :** pourcentage de boutiquiers qui utilisent GStock quotidiennement sans assistance.

---

## 15. Planning de réalisation

| Étape | Contenu | Dépend de |
|---|---|---|
| 1. Front phase 1 sur mocks | Phases F1 à F8 (§11.4) | — |
| 2. Backend socle | Laravel, Docker, CI, stancl/tenancy, Sanctum, espaces, boutiques, utilisateurs, rôles, permissions prédéfinies, affectations aux boutiques, audit | Contrat d'API de F1–F2 |
| 3. Back-office Filament | Espaces, boutiques, utilisateurs, plans, journal, tableau de bord | Étape 2 |
| 4. Backend métier | Référentiels, produits, stock, clients, ventes, crédits, approvisionnements, dépenses, tableau de bord | Étape 2 |
| 5. Branchement | Désactivation de MSW module par module, tests de bout en bout | Étape 4 |
| 6. Paiements | GeniusPay boutiques (ventes, remboursements) et plateforme (abonnements) | Étapes 3 et 5 |
| 7. Hors ligne | Phase F9 et endpoint de synchronisation | Étape 5 |
| 8. Recette et mise en production | Tests utilisateurs avec de vrais boutiquiers, hébergement, premiers espaces | Étapes 5 à 7 |
| Phase 2 | Caisse, retours, inventaire, transferts, rapports, import / export | Phase 1 |
| Phase 3 | Devis, achats avancés, combos, SMS, automatisations | Phase 2 |

---

## 16. Livrables

- Application web responsive et installable (PWA), optimisée pour mobile.
- Back-office super-admin Filament.
- Tableau de bord interactif ; POS fonctionnel en ligne et hors ligne.
- Gestion des produits et du stock par boutique.
- Modules clients et « Mes crédits clients » complets, avec remboursements, affectations et échéances.
- Approvisionnements, fournisseurs et dépenses.
- Gestion de plusieurs boutiques, des utilisateurs et des rôles créés par le propriétaire, sur la base de permissions prédéfinies.
- Inscription, abonnement et paiements GeniusPay.
- Journal d'audit.
- API documentée (OpenAPI) et base de données PostgreSQL.
- Documentation fonctionnelle et technique ; tests automatisés et critères d'acceptation validés.

---

## 17. Points ouverts

| # | Question | Recommandation | Impact |
|---|---|---|---|
| P1 | Stock négatif autorisé ? | **Décidé : non.** Toute opération qui rendrait le stock négatif est refusée (§7.2) | M07, M08, hors ligne |
| P2 | Règle de conflit à la synchronisation hors ligne | Enregistrer l'opération, la marquer « à vérifier », notifier le gérant | M08, F9 |
| P3 | Annulation d'une vente à crédit déjà partiellement remboursée | **Décidé : au choix du commerçant à l'annulation, avoir au nom du client ou argent rendu au client** (§7.6) | M08, M09 |
| P4 | Prix de vente différents selon la boutique | Phase 2 (`shop_product_prices`) | M06 |
| P5 | Clients partagés entre boutiques ou propres à chaque boutique | Partagés (choix actuel), crédits suivis par boutique | M10, M09 |
| P6 | Facture normalisée obligatoire en Côte d'Ivoire | À vérifier auprès de la DGI avant la mise en production | M08 |
| P7 | Plans tarifaires : noms, prix, limites, durée d'essai, délai de grâce | À définir par l'équipe produit | M00, M01 |
| P8 | Validation des ADR-008 (Sanctum), ADR-009 (sous-domaine) et ADR-013 (WhatsApp) | — | Socle |
| P9 | Nom de domaine de la plateforme | — | ADR-009, ADR-010 |
| P10 | Reprise de données de commerçants existants | À confirmer | Planning |
| P11 | Transfert de propriété ou second propriétaire | Prévoir un transfert du rôle Owner via le support (back-office) | M04, M01 |
| P12 | Gestion des produits périssables | **Décidé : dates de péremption par arrivage, sans numéro de lot, accessibles sans le mode avancé, champs facultatifs ; alerte à la caisse sans blocage ; pertes (périmé, cassé, volé) sur une ligne distincte du tableau de bord ; annulation d'un approvisionnement refusée si ses arrivages sont entamés** (§7.11) | M06, M07, M08, M11, M13 |
| P13 | Alerte de péremption envoyée chaque jour par WhatsApp | Envisagé pour plus tard ; demande l'API WhatsApp Business, écartée par l'ADR-013 en phase 1 | M07, ADR-013 |

---

## 18. Exigence finale de conception

GStock est conçu pour des commerçants qui veulent gérer leur activité sans devenir des spécialistes de l'informatique.

- Chaque écran répond à un besoin concret.
- Chaque carte interactive a une utilité réelle.
- Chaque action est compréhensible.
- Chaque information financière est fiable.

Le produit privilégie la **rapidité**, la **simplicité** et la **confiance**.
