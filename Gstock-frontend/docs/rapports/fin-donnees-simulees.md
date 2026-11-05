# Fin des données simulées

| | |
|---|---|
| **Statut** | Livrée le 5 novembre 2026 |
| **Branche** | `front-sans-mocks` |
| **Cahier** | ADR-004 close, §11.3 annoté |

## Pourquoi

Le backend couvre tous les modules. Garder deux serveurs (le vrai et le simulé) obligeait à tout écrire deux fois, et `npm run dev` ouvrait une application qui ne voyait pas les vraies données (un compte créé dans le backend était « incorrect » à la connexion). Le propriétaire du projet a demandé que `npm run dev` soit directement branché sur le backend, avec les comptes de test des seeders.

## Ce qui a changé

- Supprimés : `src/mocks/` (handlers, jeux de données, moteurs simulés, page de paiement et outils d'abonnement simulés), `public/mockServiceWorker.js`, la dépendance `msw`, `VITE_USE_MOCKS`, `.env.api` et le script `dev:api`.
- `npm run dev` : proxy de Vite vers l'API Docker, `http://127.0.0.1:8001` par défaut (`GSTOCK_API_URL` pour une autre, par exemple `php artisan serve`). Ouvrir `http://localhost:5173` (connexion centrale) ou le sous-domaine d'un espace.
- Comptes de test : ceux de `DemoTenantSeeder` (Aminata, Ibrahim, Fatou, Koffi, Moussa, Paul désactivé ; `demo1234`), listés sur l'écran de connexion **en développement seulement** (`src/features/auth/components/DemoAccounts.tsx`), absents du build de production.
- Service worker (`src/sw/sw.ts`) : ne charge plus le worker de MSW.
- Documentation : ADR-004 close dans les deux copies du cahier, `CLAUDE.md`, sommaire des rapports (« Démarrer en 2 minutes »).

## Vérifications

- `typecheck`, `lint`, `build` ; aucun identifiant de test dans `dist/`.
- Navigateur, contre l'API Docker : sur `localhost`, le compte d'Aminata est envoyé vers `alimentation-kone.localhost` ; sur le sous-domaine, Fatou arrive sur son accueil.

## Limites

- Sans backend lancé, le frontend ne fonctionne plus en développement.
- Le dossier `rapports/` décrit encore les phases F1 à F10 avec leurs données simulées : c'est l'historique de ce qui a été fait.
- Aucun test automatisé côté frontend ; les règles sont vérifiées par les tests du backend.
