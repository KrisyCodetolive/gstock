# F8 — SaaS : inscription, démarrage, abonnement

> **Statut : à faire.** Branche suggérée : `front-inscription`.
> Livrable du cahier (§11.4) : « Parcours d'inscription complet ». Module M00.

## Périmètre (M00)

- **Inscription** : nom de l'espace, sous-domaine, nom de la première boutique, nom, téléphone, e-mail et mot de passe du propriétaire, choix du plan.
- **Provisionnement automatique** (côté serveur) : espace, propriétaire avec le rôle Owner, première boutique, unités par défaut, modes de paiement (Espèces, Mobile Money, Carte), catégories de dépenses par défaut, séquences de références.
- **Assistant de démarrage** : ajouter ses premiers produits, saisir les dettes existantes (soldes initiaux, F5), faire une première vente.
- **Période d'essai**, puis paiement de l'abonnement via GeniusPay (clés **plateforme**, différentes de celles de l'espace).
- **Mon abonnement** : plan, échéance, factures, changement de plan (permission `subscription.manage`).
- **Limites du plan** (boutiques, utilisateurs, produits) avec message clair. Déjà appliquées côté serveur simulé pour les boutiques (3) et les utilisateurs (10) ; le plan est renvoyé par `GET /settings`.
- **Suspension** après un délai de grâce en cas d'impayé : l'espace passe en **lecture seule** (écran dédié, aucune opération possible).
- Endpoints : `POST /register`, `GET /plans`, `GET /subscription`, `POST /subscription/checkout`, `GET /subscription/invoices`, `POST /webhooks/geniuspay/platform`.

## Points d'attention

- L'espace est identifié par le **sous-domaine** (ADR-009) : l'inscription se fait sur le domaine principal, puis redirige vers `sousdomaine.gstock.app`. Le nom de domaine n'est pas encore choisi (P9).
- Plans, prix, limites, durée d'essai, délai de grâce : à définir par l'équipe produit (P7).
- Un paiement d'abonnement n'est validé qu'au webhook (ADR-003).
- Le back-office super-admin (M01) est fait en **Filament côté Laravel**, pas dans cette application.
