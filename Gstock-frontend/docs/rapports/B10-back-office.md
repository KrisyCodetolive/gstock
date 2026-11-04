# B10 — Back-office de Genius Groups (Filament)

> **Statut : terminée** (branche `back-office`).
> M01 du cahier et ADR-010 : un panneau Filament dans l'application Laravel, avec une authentification séparée, pour superviser les espaces, leurs boutiques et leurs utilisateurs, gérer les formules et les abonnements, et assister les commerçants.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `86797d7` | Back-office complet (détail ci-dessous) et 6 tests. |
| `54c238b` | Frontend : bandeau du mode support ; le lien du mode support ouvre l'accueil de la personne ; message propre à un espace suspendu par GStock (rien à payer, contacter le support). |
| `ae7c7d0` | Mise à jour de sécurité des composants Symfony (avis de `composer audit`, antérieurs à la phase). |

Le back-office livré dans `86797d7` comprend :
- Filament 5 ;
- une garde `platform` et les comptes super-admins ;
- le tableau de bord ;
- les espaces et leurs actions ;
- les boutiques ;
- les utilisateurs, avec le mode support ;
- les formules ;
- les factures, avec leur relance ;
- le journal des super-admins.

## Écrans

Le panneau est servi sur `ADMIN_DOMAIN` en production (`admin.gstock.app`), et sur `/admin` sinon. En développement : `http://localhost:8000/admin`, compte de démonstration `admin@gstock.app` / `demo1234`.

| Écran | Adresse | Contenu |
|---|---|---|
| Tableau de bord | `/admin` | Voir le détail ci-dessous. |
| Espaces | `/admin/espaces`, `/admin/espaces/{id}` | Voir le détail ci-dessous. |
| Boutiques | `/admin/boutiques` | Toutes les boutiques, avec leur espace, leur ville, le nombre d'utilisateurs affectés, de ventes, et la dernière vente. |
| Utilisateurs | `/admin/utilisateurs` | Tous les utilisateurs, avec leur espace, leur rôle, leurs boutiques, leur état et leur dernière connexion. Actions : désactiver ou réactiver (avec motif), envoyer un lien de mot de passe, **mode support**. |
| Formules | `/admin/formules` | Créer et modifier les offres et leurs limites. Pas de suppression : on désactive. Les changements sont journalisés avant et après. |
| Factures | `/admin/factures` | Toutes les factures d'abonnement, avec leur état et leur moyen de paiement. **Relance manuelle** par e-mail d'une facture non payée. |
| Journal | `/admin/journal` | Toutes les actions des super-admins : auteur, action, espace, objet, motif, avant et après. |

Le **tableau de bord** affiche :
- les espaces inscrits (dont les 30 derniers jours) ;
- les espaces activés, c'est-à-dire avec au moins un produit ;
- les espaces avec une première vente ;
- les utilisateurs actifs à 7 et à 30 jours ;
- les ventes à 30 jours ;
- les crédits clients et les paiements reçus ;
- la conversion essai → payant ;
- le churn ;
- les revenus d'abonnement du mois ;
- le tableau « Ventes par espace » sur 30 jours.

L'écran des **espaces** comprend :
- **la liste**, filtrable par état (essai, payé, impayé, suspendu, fermé), par formule et par date d'inscription, avec la dernière connexion de chaque espace ;
- **la fiche d'un espace** : coordonnées, abonnement, indicateurs d'usage, et ses boutiques, utilisateurs et factures ;
- **les actions** : suspendre, réactiver, prolonger l'essai, changer de formule.

## Fichiers clés (`Gstock-plateform/`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_11_07_000100_create_platform_admin_tables.php` | `platform_admins`, `platform_audit_logs`, et `tenants.suspended_at` / `suspension_reason` (suspension décidée par GStock). |
| `config/auth.php` | Garde `platform` et fournisseur `platform_admins`, séparés des utilisateurs des espaces (ADR-010). |
| `app/Providers/Filament/AdminPanelProvider.php` | Panneau : garde `platform`, domaine ou chemin pris dans `config('gstock.admin')`, widgets. |
| `app/Domain/Platform/Models/PlatformAdmin.php` | Seul un compte actif accède au panneau (`canAccessPanel`). |
| `app/Domain/Platform/Admin/PlatformAdministration.php` | Toutes les actions sensibles. Chacune exige un motif et est journalisée ; les actions qui touchent un espace écrivent aussi dans son propre journal. |
| `app/Domain/Platform/Admin/PlatformAudit.php` | Écriture du journal des super-admins et libellés des actions. |
| `app/Domain/Platform/Admin/PlatformMetrics.php` | Indicateurs lus dans les tables : état d'un espace et filtre SQL équivalent, usage d'un espace, tableau de bord. |
| `app/Domain/Platform/SubscriptionState.php` | Un espace suspendu par GStock est en lecture seule, quel que soit son abonnement. |
| `app/Filament/Resources/…`, `app/Filament/Widgets/…`, `app/Filament/Support/…` | Écrans, widgets, actions communes (motif obligatoire, erreurs en notification). |
| `app/Console/Commands/CreatePlatformAdmin.php` | `php artisan gstock:admin email@exemple --name="…"` crée ou réactive un compte (mot de passe de 12 caractères au moins). |
| `app/Http/Middleware/EnsureUserIsActive.php`, `AuthController::tokenLogin`, `Present::me` | Mode support : session limitée, fin automatique, `support` dans `GET /me`. |
| `tests/Feature/BackOfficeTest.php` | 6 tests. |

## Règles du cahier appliquées

- **Accès** : seul un compte `platform_admins` actif accède au panneau. Un utilisateur d'espace n'y entre pas : ce n'est pas la même garde. Un compte désactivé reçoit 403.
- **Journalisation** : chaque suspension, réactivation, prolongation, changement de formule, désactivation, envoi de lien, connexion en mode support, relance et modification de formule est journalisée avec son auteur et son motif. La connexion en mode support apparaît aussi dans le journal de l'espace, visible du commerçant.
- **Mode support** :
  - un motif est obligatoire ;
  - la durée est de 15 minutes, 30 minutes ou 1 heure ;
  - le lien est à usage unique et valable 10 minutes ;
  - la session s'arrête d'elle-même à l'heure prévue (401 « La session d'assistance est terminée. ») ;
  - un bandeau reste visible dans l'application : « Session d'assistance GStock ouverte par … jusqu'à … » ;
  - la dernière connexion de l'utilisateur n'est pas modifiée.
- **Lecture de toutes les tables d'espace** : le panneau n'initialise jamais d'espace, donc le filtre par espace ne s'applique pas. Les routes de l'API du commerçant initialisent toujours le leur.
- **Indicateurs** : ils sont lus dans les données réelles. Par exemple, « activé » se compte sur les produits existants, pas sur la colonne `activated_at` tenue par l'assistant.

## Décisions prises pendant la phase

- **Suspension par GStock distincte de l'impayé** : elle passe par la colonne `suspended_at`, et non par l'état de l'abonnement. L'espace passe en lecture seule même s'il a payé, et un paiement ne lève pas la suspension. Le frontend affiche alors « Espace suspendu par GStock » sans proposer de payer.
- **Définitions retenues** pour le tableau de bord, à valider :
  - **conversion** : parmi les espaces dont l'essai est terminé, la part qui a payé au moins une fois ;
  - **churn** : parmi les espaces qui ont payé, la part dont la période payée est finie depuis plus que le délai de grâce.
- **Ouverture du lien du mode support** : il s'ouvre dans un nouvel onglet depuis une notification persistante, pour que le super-admin garde le panneau ouvert.
- **Adresses en français** (`/admin/espaces`…) et libellés courts dans les menus d'actions.
- **Pas de création d'espace ni d'utilisateur** depuis le panneau : l'inscription et la gestion des équipes restent dans l'application.

## Vérifications faites

- **95 tests passent** (947 assertions), dont 6 nouveaux :
  - accès : invité, utilisateur d'espace, compte inactif, puis toutes les pages et les widgets du tableau de bord ;
  - suspension (motif obligatoire, lecture seule malgré un abonnement payé), réactivation, prolongation d'essai, changement de formule, toutes journalisées avec leur auteur et leur motif ;
  - filtres de la liste des espaces par état ; utilisateurs de tous les espaces ;
  - désactivation d'un utilisateur, qui ne peut alors plus se connecter ;
  - mode support : double journal, connexion avec `support` dans `GET /me` sans changer la dernière connexion, fin automatique après la durée prévue ;
  - relance d'une facture (e-mail envoyé) et modification d'une formule journalisée ;
  - indicateurs du tableau de bord comparés aux données.
- **Navigateur**, avec le back-office sur le vrai serveur et le frontend en `dev:api` :
  - connexion au panneau ; tableau de bord ; liste et fiche d'un espace (2 boutiques, 276 ventes, première vente le 05/10) ;
  - suspension puis réactivation avec motif ;
  - liste des utilisateurs ;
  - mode support sur Fatou : la notification donne le lien, qui ouvre l'accueil de Fatou avec le bandeau et l'heure de fin ;
  - journal avec les motifs.

  Aucune erreur.
- `vendor/bin/pint` passe. Frontend : `npm run typecheck`, `npm run lint` et `npm run build` passent. `composer audit` ne signale plus rien après la mise à jour Symfony.

## Pièges rencontrés

- **Arguments des fonctions de Filament** : Filament les fournit **par leur nom** (`$query`, `$data`, `$record`). Une fonction écrite `fn (Builder $q)` reçoit une requête vide, sans modèle (« Call to a member function newQueryWithoutRelationships() on null »). Toujours nommer `$query`.
- **Widgets du tableau de bord** : Filament les charge après la page. Pour les tester, il faut appeler `Livewire::test(Widget::class)` ; ils n'apparaissent pas dans le HTML de la page.
- **`actingAs($admin, 'platform')` dans un test** change la garde par défaut pour la suite du test. Il faut revenir à `web` (`shouldUse('web')`) avant de simuler un utilisateur d'espace.
- **Fichiers publiés par Filament** dans `public/` (css, js, polices) : ils sont ignorés par Git et regénérés par `composer install` (`filament:upgrade`). En déploiement, `php artisan filament:assets`.

## Limites

- **Pas de double authentification** pour les super-admins. Elle serait souhaitable avant la mise en production.
- **Relance des factures manuelle seulement** : pas de relance automatique planifiée.
- **Définitions de la conversion et du churn** à valider avec l'équipe produit.
- **Pas d'export** (CSV, Excel) des listes.
