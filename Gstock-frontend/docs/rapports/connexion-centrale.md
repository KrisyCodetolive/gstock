# Connexion centrale sur le domaine principal

| | |
|---|---|
| **Statut** | Livrée le 5 novembre 2026 |
| **Branche** | `connexion-centrale` |
| **Cahier** | ADR-009 (connexion centrale), M02 |

## Pourquoi

Jusqu'ici, la connexion ne marchait que sur le sous-domaine de l'espace (`yves-shop.localhost:5173`). Sur l'adresse principale (`localhost:5173`, demain `gstock.app`), le serveur répondait « Cet espace n'existe pas » : le commerçant devait connaître l'adresse de son espace.

## Commits

| Commit | Contenu |
|---|---|
| `docs(cahier): connexion centrale…` | ADR-009 et M02 complétés, les deux copies du cahier identiques |
| `feat(api): connexion centrale…` | `POST /api/v1/auth/central-login`, tests |
| `feat(front): connexion sur le domaine principal…` | page de connexion sur le domaine principal |

## Ce qui a été livré

- **`POST /api/v1/auth/central-login`** (domaine principal, hors espace, limité comme `/auth/login`) : `{ login, password }` → `{ data: { spaces: [{ name, slug, url, login_url }] } }`. Seuls les espaces où le compte existe **avec ce mot de passe** sont renvoyés ; comptes désactivés et espaces fermés écartés, avec le même message que la connexion de l'espace. `login_url` est le lien de connexion à usage unique déjà utilisé par l'inscription (`LoginLinks`).
- **Page de connexion** (`src/features/auth/pages/LoginPage.tsx`) : sur le domaine principal (`src/lib/tenant-host.ts`, `isCentralHost()`), elle appelle cet endpoint ; un seul espace : redirection immédiate, déjà connecté ; plusieurs : liste à choisir. « Mot de passe oublié » est masqué hors espace (il se traite sur le sous-domaine).
- Fichiers : `app/Http/Controllers/Api/V1/CentralLoginController.php`, `routes/api.php`, `tests/Feature/CentralLoginTest.php` ; `src/lib/api/auth.ts` (`centralLogin`), `src/features/auth/hooks.ts` (`useCentralLogin`), `src/types/auth.ts` (`CentralSpace`).

## Décisions

- On garde l'identification par sous-domaine (ADR-009) : la connexion centrale ne fait qu'y conduire.
- Aucun espace n'est révélé sans mot de passe juste (pas d'énumération des comptes par e-mail).
- Domaine principal = `localhost`, une adresse IP, ou un domaine à deux niveaux (`gstock.app`). Avec les données simulées, il n'y a pas de domaine principal.

## Vérifications

- Tests : `CentralLoginTest` (un espace, plusieurs espaces, mauvais mot de passe, téléphone, compte désactivé, lien à usage unique) et les tests d'authentification et d'inscription existants passent.
- Navigateur (Chrome, mobile, contre l'API locale) : sur `localhost`, mauvais mot de passe refusé, bon mot de passe → arrivée connectée sur `alimentation-kone.localhost`.

## Limites

- Le dernier espace utilisé n'est pas retenu : la liste s'affiche à chaque fois pour un compte présent dans plusieurs espaces.
- Le mot de passe oublié reste à faire depuis l'adresse de l'espace.
- Le lien de redirection suit `FRONTEND_URL` (`http://{tenant}.localhost:5173` par défaut).
