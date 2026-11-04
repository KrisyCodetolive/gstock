# Comparaison avec l'ancien GStock (Stocky v5.0)

> Établie le 4 novembre 2026, à la fin de la phase F9 ; §2.3 mis à jour à la fin de F10.
> Le nouveau GStock doit reprendre les fonctionnalités de l'ancien. Ce document confronte l'inventaire de l'ancienne application (24 modules, 178 fonctionnalités, 31 rapports) avec ce qui **existe déjà** dans le nouveau, et liste ce qui manque.

**Sources**

- Ancien GStock : « Cahier des charges — Refonte de GStock » et « Inventaire des fonctionnalités de l'existant » (Stocky v5.0, Laravel 10 / Vue 2), les identifiants `F..`, `R..`, `D..` et `N..` renvoient à ces documents.
- Nouveau GStock : `docs/cahier-des-charges-gstock-final.md` et les rapports F1 à F9 de ce dossier.

**Ce que veut dire « existe déjà ».** Tout ce qui existe est dans le frontend, sur données simulées (MSW). Le backend Laravel n'est pas commencé. « Fait » signifie donc : l'écran et ses règles fonctionnent en démonstration.

---

## 1. Ce que le nouveau GStock couvre déjà

| Ancien module | Dans le nouveau |
|---|---|
| M01 Connexion | Connexion, déconnexion, compte inactif refusé (F1) |
| M02 Tableau de bord | Six cartes, activité récente, stock faible, filtre par boutique (F7) ; les entrepôts deviennent des boutiques |
| M03 Produits | Produit simple et service, code, code-barres, catégorie, marque, taxe, seuil, désactivation, stock par boutique (F3) |
| M04 Référentiels | Catégories, marques, unités avec conversion (F2) |
| M05 Ajustements | Entrées, sorties, inventaire `MS-N`, historique des mouvements (F3) |
| M08 / M09 Ventes et caisse | Caisse plein écran, douchette, paiement mixte, rendu monnaie, paniers en attente, reçus 58/80 mm, annulation (F4), vente sans réseau (F9) |
| M12 Achats | Approvisionnements `AP-N`, paiements au fournisseur, reste dû (F6) |
| M14 Paiements | Paiements de crédit `RB-N` répartis du plus ancien au plus récent, équivalent de « Payer le dû client » (F5) ; modes de paiement paramétrables (F2) |
| M15 Tiers | Clients et fournisseurs, avec leurs totaux et leur dû (F4, F6) |
| M17 Trésorerie | Seulement les dépenses `DP-N` et leurs catégories (F6) |
| M21 Utilisateurs | Rôles libres, rôle Owner protégé, activation, accès par boutique, « voir tout ou seulement ses propres opérations » (F2) |
| M22 Paramètres | Infos de l'entreprise, fuseau horaire, pied de reçu, paramètres du reçu par boutique, client par défaut (F2) |

Le nouveau apporte aussi ce que l'ancien n'avait pas : crédits clients avec échéanciers (F5), journal d'audit (F7), abonnement SaaS (F8) et mode hors ligne (F9).

---

## 2. Fonctionnalités majeures manquantes

### 2.1 Absentes du nouveau cahier (à décider en priorité)

Elles ne sont prévues dans aucune phase. Si les clients actuels s'en servent, ils les perdront.

| Ancien module | Fonctionnalité manquante |
|---|---|
| **M13** Retours d'achat | Renvoyer de la marchandise au fournisseur et être remboursé |
| **M10** Livraisons | Expéditions `SM_` et leurs statuts (préparée, expédiée, livrée…) |
| **M16** Abonnements | Ventes récurrentes facturées automatiquement chaque jour, avec rappels SMS |
| **M17** Trésorerie | Comptes avec solde, virements entre comptes, dépôts `DP_` (la phase 2 ne prévoit qu'une « caisse » et des « recettes ») |
| **M18** Ressources humaines | Employés, présences, congés, jours fériés, paie |
| **M19** Projets et tâches | Projets, tâches, tableau Kanban (l'ancien cahier les signale comme probablement inopérants) |
| **M03** Produits | Suivi IMEI / numéro de série, garanties, option « non vendable », impression d'étiquettes code-barres |
| **M08** Ventes | Facture A4 en PDF, ventes « en commande » ou « en attente » sans sortie de stock, frais de port |
| **M20** Rapports | Relevés client et fournisseur en PDF, rapport par utilisateur, marge en FIFO ou en coût moyen pondéré, ventes par catégorie ou par marque |
| **M22** / Notifications | Envoi par e-mail (SMTP), modèles d'e-mails et de SMS modifiables |
| **M24** Sauvegardes | Sauvegarde et téléchargement de la base par le client |

### 2.2 Prévues en phase 2 ou 3, mais rien n'est encore fait

| Ancien module | Phase prévue |
|---|---|
| **M11** Retours de vente | Phase 2 |
| **M06** Transferts entre boutiques | Phase 2 |
| **M20** Rapports (ventes, stock, crédits, finances, export PDF et Excel) | Phase 2. C'est le plus gros manque : 31 rapports dans l'ancien, aucun dans le nouveau. |
| **M03** Import CSV des produits et des clients | Phase 2 |
| **M07** Devis et conversion en vente | Phase 3 |
| **M03** Produits combo | Phase 3 |
| **M12** Statuts de commande fournisseur (commandé, puis reçu) | Phase 3 |
| Notifications SMS | Phase 3 |

### 2.3 Prévues dès la V1 : livrées en F10

Ces six points manquaient à la fin de F9. Ils ont été livrés par la phase [F10](F10-complements-v1.md).

| Fonctionnalité | Situation |
|---|---|
| Mot de passe oublié et page profil (M01) | ✅ Livrés en F10 (par e-mail ; pas encore d'e-mail de confirmation) |
| Produits à variantes (M03) | ✅ Livrés en F10 (prix, code-barres et stock par variante) |
| Photo du produit | ✅ Livrée en F10 |
| Scan par la caméra du téléphone | ✅ Livré en F10 (caisse, recherche, sélecteurs, fiche produit) |
| Unité d'achat différente de l'unité de base | ✅ Livrée en F10 (l'unité de *vente* reste à faire) |
| Échéancier des dettes fournisseurs | ✅ Livré en F10 |

### 2.4 Volontairement remplacées

Ce ne sont pas des manques, mais il faudra les expliquer aux anciens clients.

| Dans l'ancien | Dans le nouveau |
|---|---|
| Modifier ou supprimer une vente, un achat ou un paiement | Annulation avec motif, aucune suppression (ADR-012) |
| Paiement par carte via Stripe | GeniusPay (ADR-003) |
| 12 langues, éditeur de traductions, arabe de droite à gauche | Français uniquement (ADR-006) |
| Choix de la devise | FCFA |
| Grille d'environ 150 permissions | Environ 40 permissions (§6.3) |
| Stock négatif possible | Stock jamais négatif (P1) |

---

## 3. Lecture

La V1 actuelle couvre bien le cœur d'un petit commerce : caisse, stock, crédits, achats simples et dépenses. Les fonctions de gestion commerciale « complète » manquent : retours, devis, livraisons, trésorerie, rapports, documents PDF. Les modules RH et Projets n'ont pas d'équivalent.

La suite dépend de ce que les 7 clients actuels utilisent réellement. Les décisions à prendre portent d'abord sur le §2.1, en particulier les retours d'achat, la trésorerie, les relevés PDF, l'IMEI et les garanties.
