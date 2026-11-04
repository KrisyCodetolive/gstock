# F1 — Socle

> **Statut : terminée** (branche `front-socle`, fusionnée dans `main` au commit `20d5b48`).
> Livrable du cahier (§11.4) : « Application navigable avec les 5 profils ».

## Objectif

Poser tout ce dont les phases suivantes ont besoin : le projet TypeScript, le design system, la couche réseau, les données simulées, la connexion, les permissions, le sélecteur de boutique et les mises en page mobile et desktop. Aucun écran métier.

## Travail préparatoire (avant le code)

| Commit | Contenu |
|---|---|
| `3dd5c94` | `CLAUDE.md` à la racine : commandes, architecture cible, méthode de travail, règles Git. |
| `8e47c05` | Décision P1 reportée dans le cahier (§7.2, M07, §17) : **le stock ne peut jamais devenir négatif**. |
| `50b69b4` | Règle reportée dans le cahier (§11.2, ADR-004) : **tous les appels réseau dans `src/lib/api/`**, `client.ts` seul appelle `fetch`. |
| `746c96d` | Noms de branches courts mais explicites (`front-socle`, pas `f1`). |
| `6c90ed2` | Design system « Marché » choisi parmi 3 directions présentées en maquettes : `design-system/gstock/MASTER.md` et `reference.html`. |

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `fef387f` | Passage en TypeScript ; installation de React Router, TanStack Query, Zustand, React Hook Form + Zod, react-i18next, MSW, Tailwind v4, lucide-react. |
| `5f7e236` | Thème « Marché » dans `src/index.css` (variables, utilitaires `pressable`, `pressable-lg`, `tabular`), police Outfit auto-hébergée, composants shadcn (base Radix) rhabillés. |
| `227b04f` | Couche réseau `src/lib/api/client.ts` (URL de base, cookie CSRF Sanctum, erreurs typées `ApiError` en français, gestion du 401) et règle oxlint qui interdit `fetch` / `axios` ailleurs. |
| `ab2d993` | Données simulées MSW : espace « Alimentation Koné », 2 boutiques (Cocody, Yopougon), 5 profils + 1 compte désactivé, endpoints d'authentification. |
| `bb45c8d` | Socle navigable : connexion, garde de session, permissions, sélecteur de boutique, barre basse mobile, barre latérale desktop, accueil, vitrine `/vitrine`. |
| `856c417` | Correctif : sélecteur de boutique en liste déroulante sur desktop (le panneau du bas sortait de l'écran). |

## Écrans

| Adresse | Écran |
|---|---|
| `/connexion` | Connexion par e-mail ou téléphone ; comptes de démonstration cliquables (seulement avec les mocks). |
| `/` | Accueil : « Bonjour Prénom » et cartes d'actions rapides selon les permissions. Deviendra le tableau de bord en F7. |
| `/vitrine` | Tous les composants « Marché » (développement uniquement). |
| — | Pages « Vous n'avez pas accès à cette page », « Page introuvable », « Bientôt disponible ». |

Mise en page (`src/app/layout/`) :
- **Mobile** : barre du haut (sélecteur de boutique, menu du compte) et barre basse de 5 entrées maximum (Accueil, Stock, **Vendre** au centre et surélevé, Crédits, Plus). « Plus » ouvre un panneau avec les autres rubriques.
- **Desktop** (≥ 1024 px) : barre latérale (logo, nom de l'espace, sélecteur, bouton « Vendre », rubriques, compte).

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/app/navigation.ts` | **Liste unique des rubriques** (adresse, libellé, icône, permissions, `phase`). Une rubrique avec `phase` affiche « Bientôt disponible ». |
| `src/app/router.tsx` | Routes ; chaque route métier est protégée par `RequirePermission`. |
| `src/features/auth/hooks.ts` | `useMe`, `useSession`, `useLogin`, `useLogout`, `useCan`. |
| `src/features/auth/components/RequireAuth.tsx` | Garde de session ; écran « aucune boutique attribuée ». |
| `src/features/shops/components/ShopSwitcher.tsx` | Sélecteur (§3.6) : invisible avec une seule boutique. |
| `src/lib/current-shop.ts` | Boutique courante, gardée sur l'appareil. |
| `src/lib/api/client.ts` | Seule couche HTTP. |
| `src/mocks/` | MSW : `browser.ts`, `handlers/`, `data/`. |
| `src/components/` | `ActionCard`, `Money`, `StatusBadge`, `PageHeader`, `states.tsx` (chargement, erreur, vide), `Logo`. |

## Endpoints

`GET /sanctum/csrf-cookie`, `POST /auth/login` (`{ login, password }`, `login` = e-mail ou téléphone), `POST /auth/logout`, `GET /me` (utilisateur, rôle, permissions, boutiques accessibles, espace).

## Règles appliquées

- Le menu, les cartes et les actions n'affichent que ce qui est autorisé ; une page interdite affiche « Vous n'avez pas accès à cette page » (§6.2).
- Un utilisateur inactif ne peut pas se connecter (M02).
- Sans affectation à une boutique, un collaborateur n'a accès à rien (écran dédié).
- Le build de production ne contient aucune donnée de démonstration (comptes chargés à la demande seulement avec les mocks).

## Vérifications faites

Navigateur piloté (Playwright), mobile 390 px et desktop 1366 px : redirection vers la page demandée après connexion, menus différents selon les 5 profils, sélecteur absent pour une seule boutique, refus du compte désactivé, page interdite atteinte par son adresse.

## Limites

- Pas de « mot de passe oublié » ni de page profil (M02).
- Pas de vrai Sanctum : le client est prêt (`credentials: 'include'`, `X-XSRF-TOKEN`), le serveur n'existe pas encore.
