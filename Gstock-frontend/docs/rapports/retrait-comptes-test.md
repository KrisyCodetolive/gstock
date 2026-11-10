# Retrait des comptes et données de démonstration

| | |
|---|---|
| **Statut** | Livré le 10 novembre 2026, avant la mise en production |
| **Branche** | `retrait-comptes-test` |
| **Cahier** | v3.11 (§ sur la fin des données simulées) |

## Commits

| Commit | Contenu |
|---|---|
| `chore(front)` | Retrait de l'encart des comptes de démonstration de l'écran de connexion, du lien de démonstration du mot de passe oublié et des textes de simulation inutilisés |
| `chore(api)` | Suppression des seeders de démonstration et du compte admin de démonstration |
| `docs` | Cahier v3.11, README, CLAUDE.md, ce rapport |

## Ce qui a été retiré

**Frontend :**
- `src/features/auth/components/DemoAccounts.tsx`, et son chargement sur l'écran de connexion (`LoginPage.tsx`) :
  - c'est la liste des 6 profils et du mot de passe `demo1234` ;
  - elle n'était déjà chargée qu'en développement.
- Le bouton « Démonstration : ouvrir le lien reçu » du mot de passe oublié, et le champ `demo_reset_url` (`ForgotPasswordResult`). Il venait des données simulées, et le vrai serveur ne le renvoyait pas.
- Des textes sans usage :
  - `auth.demo_*` et `auth.forgot.demo_link` ;
  - le bloc `simulation` de `onboarding.json`, reste des données simulées. La page de paiement simulée de GeniusPay est servie par le backend.

**Backend :**
- `DemoTenantSeeder`, `DemoCatalogSeeder`, `DemoSalesSeeder` et `DemoPurchasesSeeder` : l'espace « alimentation-kone », ses 6 comptes, son catalogue, ses ventes et ses approvisionnements.
- Le compte du back-office de démonstration, `admin@gstock.app` / `demo1234`.
- `DatabaseSeeder` n'appelle plus que `PlanSeeder`, qui crée les formules d'abonnement.

**Base Docker locale :** elle a été remise à zéro. Il reste 0 espace, 0 utilisateur, 0 administrateur et 3 formules.

## Ce qui reste, volontairement

- **Page de paiement simulée de GeniusPay** (pilote `simulation`) :
  - elle est déjà refusée en production (`AppServiceProvider`, `GeniusPaySimulationController`) ;
  - le pilote réel reste à écrire.
- **Vitrine des composants** `/vitrine` : en développement seulement.
- **Comptes créés par les tests** (`createTenant()`, `createUser()`) : ils n'existent que dans la base `gstock_test`, le temps d'un test.
- **Le mot « demo »** dans les sous-domaines réservés de l'inscription : personne ne peut prendre `demo.gstock.app`.

## Démarrer sans comptes de test

- Pour ouvrir un espace : « Créer mon espace » (`/inscription`), puis ajouter les utilisateurs et les rôles dans Paramètres.
- Pour créer un administrateur du back-office : `php artisan gstock:admin vous@exemple.ci`. La commande demande un mot de passe de 12 caractères au moins.

## Vérifications

- Backend : les 115 tests passent, et pint ne signale rien.
- Frontend :
  - `typecheck`, `lint` et `build` passent ;
  - le build ne contient ni `demo1234` ni `demo.gstock`.
- API Docker :
  - reconstruite, elle démarre sur une base vide ;
  - `/admin/login` et `register/check-slug` répondent.

## À faire au moment de la mise en production

- La base de production doit partir des migrations seules. Le conteneur exécute `migrate` puis `PlanSeeder` au démarrage.
- Ne jamais y copier la base locale ou de test.
- Créer le premier administrateur avec `php artisan gstock:admin`.
- `APP_ENV=production` est déjà fixé dans le `Dockerfile` ; ne pas le remplacer par `local`, comme le fait `compose.yaml` pour le développement.
