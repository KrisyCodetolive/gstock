# Mots de passe : 6 caractères au moins

| | |
|---|---|
| **Statut** | Livré le 10 novembre 2026 |
| **Branche** | `mdp-six-caracteres` |
| **Cahier** | Aucune longueur n'y est fixée : rien à reporter |

## Changement

Les mots de passe des comptes des commerçants demandent maintenant **6 caractères au moins**, au lieu de 8. Les messages d'erreur et les aides suivent : « Le mot de passe doit contenir au moins 6 caractères. »

| Où | Backend | Frontend |
|---|---|---|
| Inscription (`/inscription`) | `RegistrationService` | `features/onboarding/schemas.ts` |
| Nouveau mot de passe après un oubli | `AuthController` (`min:6`) | `features/auth/schemas.ts` |
| Utilisateur créé ou modifié par le propriétaire | `UserController` (`min:6`) | `UserFormPage.tsx` |
| Changement de son mot de passe (`/profil`) | `MeController` (`min:6`) | même schéma que la réinitialisation |

## Décision

- **Le back-office garde 12 caractères au moins.** C'est le compte administrateur de Genius Groups (`php artisan gstock:admin`), qui donne accès à tous les espaces.
- Les mots de passe existants ne changent pas.

## Vérifications

- Backend : les 115 tests passent, et pint ne signale rien. `RolesAndUsersTest` refuse 5 caractères et accepte « secret » (6 caractères) à la création et à la connexion.
- Frontend : `typecheck`, `lint` et `build` passent.
