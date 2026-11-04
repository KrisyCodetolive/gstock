# F2 — Espace

> **Statut : terminée** (branche `front-espace`, fusionnée dans `main` au commit `344c31e`).
> Livrable du cahier (§11.4) : « Configuration complète d'un espace ». Modules M03, M04, M05.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `50f4796` | Briques communes : base simulée **modifiable et persistante** (`src/mocks/db.ts`), outils serveur (`src/mocks/http.ts`), liste qui devient tableau sur desktop (`DataList`), recherche et pagination (`ListControls`), champs de formulaire (`FormField`, `FormLayout`), panneau adaptatif (`ResponsiveSheet`), confirmation (`ConfirmDialog`), notifications (sonner). |
| `50ff3be` | Paramètres de l'espace et paiements en ligne GeniusPay (M03). |
| `aa2d81b` | Boutiques (M03). |
| `272e81a` | Correctif : après une déconnexion, la personne suivante arrive sur l'accueil. |
| `bbd5df3` | Rôles et permissions (M04). |
| `1477e34` | Utilisateurs et « Qui a accès à cette boutique ? » (M04). |
| `4ae4227` | Référentiels (M05). |
| `ebe94dc` | Bouton de remise à zéro des données de démonstration. |

Toutes les rubriques sont sous **Paramètres** ; l'accueil des paramètres (`features/settings/sections.ts`) n'affiche que celles autorisées. L'interface affiche « Propriétaire » pour le rôle `Owner` (`src/lib/roles.ts`).

## M03 — Espace, boutiques, paramètres

| Adresse | Écran | Permission |
|---|---|---|
| `/parametres` | Accueil des paramètres (Mon commerce, Mon équipe, Listes de référence) | une des permissions de paramètres |
| `/parametres/espace` | Nom, coordonnées, message des reçus, fuseau horaire, mode avancé, rappel du plan | `settings.manage` |
| `/parametres/paiements-en-ligne` | Clés GeniusPay, mode test, activation, « Tester la connexion » | `payment_settings.manage` |
| `/parametres/boutiques`, `/nouvelle`, `/:id` | Liste, création, fiche (adresse, reçu, accès, fermeture) | `shops.manage` |

- **Fichiers** : `src/features/settings/`, `src/features/shops/`, `src/types/settings.ts`, `src/lib/api/settings.ts`, `src/lib/api/shops.ts`, `src/mocks/handlers/settings.ts`, `src/mocks/handlers/shops.ts`.
- **Endpoints** : `GET|PUT /settings` (avec `plan`), `GET|PUT /settings/payment`, `POST /settings/payment/test`, `GET|POST /shops`, `GET|PUT /shops/{id}`.
- **Règles** : clés GeniusPay jamais renvoyées en clair (indice `•••• abcd`, champ vide = garder la clé) ; activation impossible sans clé API et clé secrète ; limite de **3 boutiques ouvertes** (plan de démo) ; pas de suppression : fermer / rouvrir ; au moins une boutique ouverte ; une boutique fermée disparaît du sélecteur ; noms uniques.
- **Limites** : pas d'envoi de logo ; « client par défaut » d'une boutique non proposé (les clients arrivent en F4, à ajouter).

## M04 — Utilisateurs, rôles, permissions

| Adresse | Écran | Permission |
|---|---|---|
| `/parametres/roles`, `/nouveau`, `/:id` | Liste, création, modification, suppression | `roles.manage` |
| `/parametres/utilisateurs`, `/nouveau`, `/:id` | Liste filtrable par rôle, création, fiche, désactivation | `users.manage` |

- **Fichiers** : `src/features/roles/` (`PermissionGrid.tsx`, `examples.ts`), `src/features/users/`, `src/features/shops/components/ShopAccess.tsx`, `src/types/users.ts`, `src/types/auth.ts` (les **42 permissions** du §6.3), `src/mocks/data/permissions.ts` (libellés français et groupes).
- **Endpoints** : `GET /permissions`, `GET|POST /roles`, `GET|PUT|DELETE /roles/{id}`, `GET|POST /users` (filtres `role_id`, `shop_id`, `is_active`), `GET|PUT /users/{id}`, `PATCH /users/{id}/status`, `PUT /users/{id}/shops`.
- **Règles** (ADR-014) : grille des permissions par domaine avec « Tout cocher » ; exemples (Vendeur, Caissier, Gestionnaire de stock, Gérant) appliqués en un clic sans rien enregistrer ; Owner en lecture seule, ni modifiable ni supprimable, nom réservé ; rôle attribué non supprimable (409) ; changement de permissions **immédiat** pour tous les utilisateurs du rôle ; un seul rôle par utilisateur, jamais Owner ; connexion par e-mail **ou** téléphone (au moins un), tous deux uniques ; mot de passe d'au moins 8 caractères ; limite de 10 utilisateurs (plan de démo) ; le propriétaire ne peut être ni désactivé ni modifié par un autre ; on ne se désactive pas soi-même ; un compte désactivé perd sa session.
- **Limites** : création en deux appels (`POST /users` puis `PUT /users/{id}/shops`, comme le cahier) ; journalisation des changements de rôles non faite (M14, F7).

## M05 — Référentiels

| Adresse | Écran | Permission |
|---|---|---|
| `/parametres/categories` | Catégories de produits (nom, couleur de vignette) | `categories.manage` |
| `/parametres/unites` | Unités de base et dérivées | `units.manage` |
| `/parametres/modes-de-paiement` | Nom, type, GeniusPay | `settings.manage` |
| `/parametres/categories-de-depenses` | Nom | `settings.manage` |
| `/parametres/marques` | Nom (mode avancé ; un message invite à l'activer sinon) | `settings.manage` |

- **Fichiers** : `src/features/referentials/` (écran générique `ReferentialPage.tsx`, formulaire en panneau `SheetForm.tsx`, `use-referential-form.ts`), `src/types/referentials.ts`, `src/lib/api/referentials.ts`, `src/mocks/handlers/referentials.ts` (fabrique `crud()`).
- **Endpoints** : `GET|POST /{categories|units|payment-methods|expense-categories|brands}`, `PUT /…/{id}`. **Pas de DELETE** : on désactive (« Utilisable »).
- **Règles** : noms uniques ; unité dérivée rattachée à une unité de base (jamais à une autre dérivée) avec `*` ou `/` et une valeur > 0, aperçu « 1 Carton = 12 Unité » ; une unité dont d'autres dépendent reste une unité de base ; GeniusPay seulement pour Mobile Money et carte.

## Données simulées

- `src/mocks/db.ts` part des jeux de `src/mocks/data/` et garde les modifications dans le `localStorage` (clé versionnée, aujourd'hui `gstock.mock.db.v3`). **Incrémenter la clé** si la forme des données change.
- `src/mocks/http.ts` : `handle`, `requireUser`, `requirePermission` (403), `Validator` (422 en français), `findOr404`, `paginate` (recherche sans accents, tri, filtres `filter[x]`, `meta`).

## Vérifications faites

Navigateur, mobile et desktop : validations en français, enregistrement et persistance après rechargement, limite du plan, fermeture d'une boutique et sélecteur mis à jour, rôle Owner en lecture seule, suppression d'un rôle libre et refus pour un rôle attribué, **retrait d'une permission appliqué tout de suite** à l'utilisateur concerné, création d'un utilisateur puis connexion par téléphone, compte désactivé refusé, accès refusé au vendeur.
