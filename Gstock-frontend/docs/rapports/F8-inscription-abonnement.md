# F8 — Inscription, assistant de démarrage, abonnement

> **Statut : terminée** (branche `front-inscription`).
> Livrable du cahier (§11.4) : « Parcours d'inscription complet ». Module M00, ADR-003 (GeniusPay plateforme), ADR-009 (sous-domaine).

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `51f8987` | **Plateforme simulée** (`src/mocks/platform.ts`, `src/mocks/handlers/platform.ts`) : plusieurs espaces dans le navigateur, plans, abonnements, factures, webhook GeniusPay, inscription avec provisionnement, lien de connexion à usage unique, assistant de démarrage, **garde « lecture seule »** des espaces suspendus ; limite de produits du plan ; contrat (`src/types/subscription.ts`, `src/lib/api/subscription.ts`). |
| `ee0d579` | Écrans : inscription en trois étapes, ouverture par lien, assistant `/demarrage`, « Mon abonnement », bandeau d'abonnement, écran de suspension de la caisse ; outils de simulation (démo seulement). |

### Plusieurs espaces dans la démo

Jusqu'à F7, la base simulée ne contenait qu'un espace. Elle en contient maintenant plusieurs, comme le filtre `tenant_id` du serveur :

- `src/mocks/platform.ts` tient les tables sans `tenant_id` (§8.1) : `tenants`, `plans`, `tenant_subscriptions`, `tenant_invoices`, plus les liens de connexion. Clé `gstock.mock.platform.v1`.
- Chaque espace a sa propre base : `gstock.mock.db.v7.<slug>`. L'espace de démonstration est `alimentation-kone`.
- `platform.current` joue le rôle du **sous-domaine** : c'est l'espace ouvert dans le navigateur. La session est rangée par espace (`gstock.mock.session.<slug>`), comme le cookie de chaque sous-domaine.
- Sur l'écran de connexion (démo seulement), on voit l'espace ouvert et on peut passer à un autre espace créé sur ce navigateur, ou revenir à la démonstration. Le bouton de remise à zéro efface désormais **tout** : plateforme, espaces créés et sessions.

## Écrans

| Adresse | Écran | Accès |
|---|---|---|
| `/inscription` | **Créer mon espace** en trois étapes : le commerce (nom, adresse `<slug>.gstock.app` proposée à partir du nom et vérifiée pendant la saisie, avec une proposition libre si elle est prise ; première boutique et ville), le propriétaire (prénom, nom, téléphone, e-mail, mot de passe), la formule (essai gratuit, rien à payer). Lien depuis l'écran de connexion. | public (domaine principal) |
| `/connexion/lien?jeton=` | Ouverture du nouvel espace avec la session du propriétaire, puis l'assistant. Lien expiré ou déjà utilisé : message clair et accès à la connexion. | public |
| `/demarrage` | **Assistant de démarrage** : ajouter ses premiers produits, saisir les dettes existantes (ouvre directement la saisie d'une ancienne dette via `/credits?ancienne=1`), faire une première vente. Chaque étape est cochée par le serveur quand elle est faite, ou peut être passée ; l'assistant peut être fermé. Une carte « Bien démarrer » le rappelle sur l'accueil. | propriétaire |
| `/parametres/abonnement` | **Mon abonnement** : formule et état (essai, actif, à régler, suspendu), échéance, bouton de paiement GeniusPay, changement de formule, utilisation face aux limites (boutiques, utilisateurs, produits), factures avec détail. | `subscription.manage` |
| bandeau | En haut de l'application : fin d'essai à 3 jours ou moins, abonnement à régler (délai de grâce), espace en lecture seule. Lien vers l'abonnement, ou « Prévenez le propriétaire » sans la permission. | tous |
| `/vendre` (suspendu) | **Écran de suspension** : la caisse est remplacée par un message, avec le lien de paiement pour le propriétaire. | tous |
| `/simulation/geniuspay/:id` | Page de paiement GeniusPay **simulée** (choix Wave, Orange Money, MTN Money, Moov Money, carte ; payer, échouer, abandonner). Absente du build de production. | démo seulement |

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/mocks/platform.ts` | Tables plateforme, plans, calcul de l'état de l'abonnement (`subscriptionState`), factures, webhook `geniusPayPlatformWebhook`. |
| `src/mocks/handlers/platform.ts` | Garde lecture seule, `/plans`, `/register`, `/register/check-slug`, `/auth/token-login`, `/subscription*`, `/onboarding*`. |
| `src/mocks/db.ts` | Une base par espace (`openTenantDb`, `saveTenantDb`), provisionnement `newTenantDb`, `resetAllMocks`. |
| `src/types/subscription.ts`, `src/lib/api/subscription.ts` | Contrat et appels. |
| `src/features/onboarding/` | `pages/` (RegisterPage, TokenLoginPage, OnboardingPage, SubscriptionPage), `components/` (PlanCard, OnboardingCard, SubscriptionBanner avec `RequireWritable`), `hooks.ts`, `schemas.ts`, `steps.ts`. |
| `src/mocks/components/` | Page GeniusPay simulée et outils de simulation de l'abonnement, chargés seulement avec les mocks. |
| `src/lib/use-debounced-value.ts` | Attente de fin de saisie (adresse, et caisse qui l'avait en local). |

## Endpoints

Prévus par le cahier : `POST /register`, `GET /plans`, `GET /subscription`, `POST /subscription/checkout`, `GET /subscription/invoices`, `POST /webhooks/geniuspay/platform` (simulé par une fonction : c'est un appel de serveur à serveur).

Ajouts à reporter dans le cahier :
- `GET /register/check-slug?slug=` → `{available, message, suggestion}` ;
- `POST /auth/token-login {token}` : la réponse de `/register` contient `login_url`, un lien à usage unique (10 minutes) vers le sous-domaine du nouvel espace, qui ouvre la session du propriétaire ;
- `GET /onboarding`, `POST /onboarding/steps/{step}/skip`, `POST /onboarding/dismiss` (propriétaire) ;
- `GET /me` renvoie `tenant.subscription` : `{status, tenant_status, read_only, days_left}` ;
- `GET /subscription` renvoie `usage` et `pending_invoice` ; `POST /subscription/checkout {plan_id}` renvoie `{invoice, checkout_url}` ;
- **statut 402** pour toute écriture refusée parce que l'espace est suspendu ; `max_products` dans les limites du plan (`GET /settings`).

## Règles appliquées

- **Provisionnement** (M00) : espace, propriétaire avec le rôle Owner, première boutique, unités par défaut, modes de paiement (Espèces, Mobile Money, Carte bancaire), catégories de dépenses, séquences de références. Aucune catégorie de produits ni donnée de démonstration.
- **Adresse de l'espace** (ADR-009) : 3 à 30 caractères, minuscules sans accent, chiffres et tirets ; unique sur la plateforme ; sous-domaines réservés refusés (`www`, `admin`, `api`, `app`…).
- **Paiement GeniusPay** (ADR-003) : une facture `FA-N` en attente est créée, puis la personne passe sur la page de paiement. **Seul le webhook valide** : un succès prolonge l'abonnement d'une période à partir de la fin en cours (essai compris) et applique la formule payée ; un échec ne change rien ; une facture déjà traitée n'est pas rejouée. Au retour, « Mon abonnement » affiche « Paiement en attente de confirmation » et relit l'état toutes les 2 secondes jusqu'au résultat.
- **Limites du plan** : boutiques ouvertes, utilisateurs, produits actifs, avec un message clair quand la limite est atteinte. Passer à une formule plus petite est refusé si l'utilisation dépasse ses limites.
- **Suspension** (M00) : à l'échéance impayée, 7 jours de grâce (bandeau « à régler »), puis l'espace passe en **lecture seule** : toute écriture est refusée (402), sauf se connecter, payer et l'assistant. Les données restent consultables.
- **Connexion** (M02) : refusée pour un espace fermé par Genius Groups ; un espace suspendu reste accessible en lecture.
- L'état de l'abonnement est **recalculé à partir des dates à chaque requête**, comme le ferait une tâche planifiée sur le serveur.

## Décisions prises pendant la phase

| Sujet | Décision |
|---|---|
| Plans (P7, toujours ouvert) | Hypothèse de travail : Essentiel (5 000 FCFA/mois : 1 boutique, 3 utilisateurs, 300 produits), Commerce (12 000 : 3, 10, 2 000), Réseau (25 000 : 10, 30, 10 000). Essai de 14 jours, délai de grâce de 7 jours. Mensuel seulement. À remplacer par les choix de l'équipe produit (le back-office M01 gérera les plans). |
| Suspendu ou refusé | « Espace suspendu » (impayé) = lecture seule et connexion permise (M00). Le refus de connexion de M02 s'applique à l'espace **fermé** (`cancelled`). |
| Passage au sous-domaine | Après l'inscription sur le domaine principal, un lien de connexion à usage unique ouvre le nouvel espace sur son adresse, déjà connecté. |
| Paiement pendant l'essai | Possible ; la période payée commence à la fin de l'essai (aucun jour perdu). |
| Assistant | Réservé au propriétaire ; étapes cochées par le serveur à partir des données réelles (produit, ancienne dette, vente) ; dates d'activation et de première vente notées pour le back-office. |

## Vérifications faites

- **Parcours complet dans le navigateur (mobile)** : adresse prise → proposition « alimentation-kone-2 » ; validation de chaque étape ; création → ouverture du nouvel espace sur l'assistant ; produit ajouté → étape cochée ; étape passée ; carte « Bien démarrer » sur l'accueil ; paiement Wave sur la page simulée → « en attente » → « Paiement reçu », formule active jusqu'à la date prolongée ; simulation de la suspension → bandeau rouge, caisse bloquée, écriture refusée (402) ; retour à un abonnement payé → écriture acceptée (201).
- **Appels directs** : plans ; adresses réservées, mal formées ou prises ; 422 sur une inscription vide (10 champs) ; changement vers Essentiel refusé pour la démo (2 boutiques, 6 utilisateurs) ; lien de connexion accepté une fois puis refusé ; `GET /me` du nouvel espace (essai, 14 jours, une boutique) ; modes de paiement provisionnés.
- **Desktop** : choix de formule dans le panneau, refus expliqué ; déconnexion, passage à l'autre espace depuis l'écran de connexion, connexion par téléphone du nouveau propriétaire.
- Tous les scénarios de F1 à F7 repassent ; `typecheck`, `lint` et `build` sans erreur ; le build de production ne contient ni la page GeniusPay simulée ni les outils de simulation.

## Limites

- Le sous-domaine est simulé : tout tourne sur la même adresse (`localhost`) ; en production, le frontend devra lire l'espace depuis l'adresse et le lien de connexion pointera vers `https://<slug>.gstock.app`.
- Pas d'e-mail de bienvenue ni de vérification du téléphone ou de l'e-mail.
- Pas de facturation annuelle, de prorata au changement de formule, ni de facture téléchargeable (PDF).
- Les textes des outils de simulation sont dans les fichiers de langue, donc présents dans le build (pas de données de démonstration).
- Le back-office super-admin (M01 : prolonger un essai, suspendre, fermer un espace) relève de Filament, côté backend.
