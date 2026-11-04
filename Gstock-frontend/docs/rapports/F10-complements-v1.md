# F10 — Compléments de la V1

> **Statut : terminée** (branche `front-complements-v1`).
> Étape hors §11.4 : elle livre ce que le cahier prévoit dès la V1 mais qui manquait après F9, relevé par la [comparaison avec l'ancien GStock](comparaison-ancien-gstock.md) (§2.3). Modules M02, M06, M07, M08, M11, §7.3 et §7.7.

## Ce qui a été livré

| Commit | Contenu |
|---|---|
| `e612418` | Comparaison de l'inventaire de l'ancien GStock (Stocky v5.0) avec le nouveau : ce qui est couvert, prévu, partiel ou absent. |
| `1a8aada` | **M02** : mot de passe oublié (lien à usage unique, valable 60 minutes), réinitialisation, page « Mon profil » (nom, e-mail, téléphone, photo, changement de mot de passe). Envoi de fichiers dans `client.ts` (multipart). |
| `3f9989a` | **M06** : photo du produit, réduite sur l'appareil avant l'envoi, affichée dans la liste, la fiche, la caisse, les sélecteurs et Mon stock. |
| `e6d2038` | **M06, M08** : scan des codes-barres par la caméra (caisse, Mes produits, sélecteur de produits, champ code-barres). Codes EAN-13 de démonstration rendus valides. |
| `20ee44a` | **§7.3, M11** : unité d'achat (Carton = Unité × 12) sur la fiche produit, et choix de l'unité pour chaque ligne d'approvisionnement ; le serveur convertit en unité de base. |
| `abaafd2` | **§7.7, M11** : échéancier des dettes fournisseurs, badge et filtre « en retard ». Le moteur et le panneau d'échéancier sont désormais communs aux crédits clients et aux fournisseurs. |
| `58d29c7` | **M06, M07, M08, M11** : produits à variantes (prix, code-barres et stock par variante) dans le catalogue, la caisse, les ventes, les reçus, les approvisionnements, les mouvements de stock et le hors ligne. La base simulée passe à `gstock.mock.db.v8`. |

Jeu de démonstration : « Jus de fruits 1 L » (Ananas, Bissap, Gingembre) est un produit à variantes ; Coca-Cola, Fanta et les deux savons s'achètent au carton de 12.

## Écrans

| Adresse | Écran | Permission |
|---|---|---|
| `/mot-de-passe-oublie` | Saisie de l'e-mail ; même réponse que le compte existe ou non | aucune (public) |
| `/reinitialiser-mot-de-passe?jeton=` | Nouveau mot de passe saisi deux fois, puis retour à la connexion | aucune (lien à usage unique) |
| `/profil` (menu « Mon compte ») | Photo, prénom, nom, e-mail, téléphone, changement de mot de passe (l'ancien est exigé) | toute personne connectée |
| `/produits/nouveau`, `/produits/:id` | Section « Photo » ; scan du code-barres ; en mode avancé : unité d'achat, type « Avec variantes » et éditeur de variantes ; stock par variante et par boutique | `products.create` / `products.update` |
| `/produits` | Bouton de scan ; prix « à partir de … · n variantes » | `products.view` |
| `/vendre` | Bouton de scan ; une tuile par variante | `sales.create` |
| `/approvisionnements/nouveau` | Choix de l'unité (« Carton de 12 u »), prix par unité choisie, « 24 u entrent en stock » ; une ligne par variante | `purchases.create` |
| `/approvisionnements/:id` | Unité et quantité entrée en stock par ligne ; section « Échéancier » | `purchases.view` (échéancier : `purchase_payments.create`) |
| `/approvisionnements` | Badge « … FCFA en retard », filtre « Échéance en retard » | `purchases.view` |

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/lib/api/client.ts` | `http.upload` : envoi `multipart/form-data` (le navigateur pose l'en-tête). |
| `src/lib/image.ts`, `src/components/PhotoPicker.tsx` | Contrôle du type et du poids, réduction en JPEG (512 px, 256 px pour l'avatar), aperçu, « Changer », « Retirer ». |
| `src/lib/barcode.ts`, `src/lib/barcode-fallback.ts`, `src/components/BarcodeScanner.tsx` | Détecteur natif du navigateur, sinon `barcode-detector` (zxing en WebAssembly, chargé à la demande et servi par l'application) ; panneau caméra et `ScanButton`. |
| `src/features/auth/pages/ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `src/features/profile/pages/ProfilePage.tsx` | Écrans M02. |
| `src/mocks/units.ts` | `unitFactor`, `unitFamily`, `unitOption` (§7.3). |
| `src/mocks/installments.ts`, `src/components/InstallmentScheduleSheet.tsx` | Échéancier commun (§7.7) : `scheduleOf`, `buildSchedule`, et le panneau de saisie. |
| `src/mocks/stock.ts` | Stock par (produit, variante, boutique) : `stockRow(shop, product, variant)`, `stockKeys`, `productQuantity`, `resolveArticle`, `itemName`. |
| `src/lib/articles.ts` | `articleKey(productId, variantId)` : clé d'un article (produit ou variante) dans les paniers, les formulaires et les listes. |
| `src/features/products/components/VariantsEditor.tsx` | Éditeur de variantes de la fiche produit. |

## Endpoints

Prévus par le cahier : `POST /auth/forgot-password`, `POST /auth/reset-password`, `PUT /me`, `PUT|GET` des échéances (pour les crédits).

**Ajoutés** (à reporter dans le cahier) :
- `PUT /me/password` (`current_password`, `password`, `password_confirmation`, réponse 204) ; `POST /me/avatar` (multipart `avatar`), `DELETE /me/avatar` ; `PUT /me` et les deux appels de photo renvoient le nouveau `GET /me` ;
- `POST /products/{id}/image` (multipart `image`), `DELETE /products/{id}/image` ;
- `PUT /shops/{id}/purchases/{id}/installments` ; `installments` sur l'approvisionnement ; `overdue_amount` et filtre `filter[overdue]` dans la liste ;
- produit : `purchase_unit_id` (payload), `purchase_unit` et `units` (unités utilisables avec leur `factor`), `variants` ; `type: 'variable'` accepté ;
- lignes d'approvisionnement : `unit_id` (entrée), `unit` et `base_quantity` (sortie) ;
- `variant_id` sur les lignes de vente, d'approvisionnement et de mouvement de stock (entrée et sortie), `variant` sur les lignes renvoyées ; recherche et `pos/bootstrap` : une entrée par variante (`variant_id`, `variant_name`), `image_url` ; `GET /products/{id}/stock` : `variants` par boutique ; `variant` dans les listes de stock et les mouvements.
- Données simulées uniquement : `demo_reset_url` dans la réponse de `forgot-password` (le lien qu'aurait contenu l'e-mail). **Le vrai serveur ne doit jamais le renvoyer.**

## Règles appliquées

- **M02** : la demande de lien répond toujours la même chose (pas d'énumération des comptes) ; le lien sert une fois et expire après 60 minutes ; la réinitialisation ferme les sessions ouvertes ; le changement de mot de passe exige l'ancien ; e-mail et téléphone restent uniques ; changement et réinitialisation sont journalisés (`user.password_changed`, `user.password_reset`). Rôle et boutiques restent gérés par le propriétaire.
- **Fichiers** (§12.1) : JPEG, PNG ou WebP seulement, refus côté serveur (422) ; photo réduite sur l'appareil avant l'envoi.
- **Scan** : le code lu passe par la même recherche que la douchette (un code-barres exact ne renvoie que son article) ; le lecteur WebAssembly est mis en cache pour marcher sans réseau.
- **§7.3** : l'unité d'achat est une unité dérivée de l'unité du produit (sinon 422) ; la quantité entrée en stock est convertie en unité de base par le serveur ; « mettre à jour le prix d'achat » enregistre le prix par unité de base (prix du carton ÷ 12) ; l'annulation retire la quantité en unité de base.
- **§7.7** : le total des échéances doit égaler le reste dû ; les paiements soldent la plus ancienne d'abord ; une échéance dépassée non soldée est « en retard » ; refaire l'échéancier garde ce qui est déjà payé. Mêmes règles pour les clients et les fournisseurs.
- **Variantes** (§7.2) : le stock est tenu par (produit, variante, boutique) et reste égal à la somme des mouvements, jamais négatif (message « il reste 1 btl de Jus de fruits 1 L — Bissap ») ; une vente, un approvisionnement ou un mouvement sur un produit à variantes exige la variante (422) ; noms et codes-barres uniques ; au moins une variante en vente ; une variante ne se supprime pas, elle se met hors vente ; le type « à variantes » ne change plus après la création ; prix « à partir de » = plus bas prix des variantes en vente ; une nouvelle boutique crée une ligne de stock à 0 pour chaque variante.

## Décisions prises pendant la phase

- **Mot de passe oublié par e-mail seulement.** Une personne qui se connecte avec son téléphone demande au propriétaire de changer son mot de passe (c'est déjà possible dans Utilisateurs). L'envoi par SMS attendra la phase 3 (notifications SMS).
- **Photos réduites sur l'appareil** (512 px pour les produits, 256 px pour l'avatar), pour économiser les données mobiles. Le serveur range les fichiers sur un stockage objet et renvoie leur adresse.
- **Lecteur de codes-barres** : le détecteur natif s'il existe (Chrome Android), sinon zxing (WebAssembly, environ 400 Ko compressés) servi par l'application et mis en cache, jamais par un CDN.
- **Unité choisie par ligne d'approvisionnement**, proposée à partir de l'unité d'achat du produit. Le sélecteur n'apparaît qu'en mode avancé ou si le produit a déjà une unité d'achat. L'unité de *vente* reste l'unité de base (voir les limites).
- **Échéancier fournisseur** géré avec la permission `purchase_payments.create` (la même que pour payer le fournisseur).
- **Variantes vues comme des « articles »** : dans les listes renvoyées par l'API, `product.name` contient le nom de la variante (« Jus de fruits 1 L — Bissap ») et `variant` la précise. Les écrans existants affichent ainsi le bon nom sans changement.
- **Base simulée v8** : la forme des données change (stock et lignes par variante). Les bases v7 sont abandonnées et la démo repart de zéro.

## Vérifications faites

Navigateur piloté (Chrome, Playwright), en mobile 390 px et en desktop 1366 px :
- **M02** : e-mail invalide refusé ; compte inconnu, même message et aucun lien ; mots de passe différents refusés ; réinitialisation suivie d'un retour à la connexion ; lien déjà utilisé refusé ; ancien mot de passe refusé, nouveau accepté ; profil : téléphone déjà pris refusé, téléphone normalisé, photo envoyée en JPEG et visible dans le menu, fichier texte refusé, photo retirée, mot de passe actuel faux refusé puis changement accepté.
- **Photo produit** : aperçu avant la création puis envoi juste après ; photo visible dans la liste, la fiche et la caisse ; retrait ; un vendeur n'a pas le bouton et l'appel direct est refusé (403).
- **Scan** : fausse caméra (vidéo d'un code EAN-13), lecteur WebAssembly : le riz est ajouté au panier de la caisse ; la liste des produits est filtrée ; le sélecteur trouve le produit ; le champ code-barres est rempli. Le build contient le `.wasm` dans le précache.
- **Unité d'achat** : 2 cartons de Coca à 3 480 FCFA donnent 24 u en stock (72 → 96) et un prix d'achat de 290 FCFA par unité ; l'annulation ramène le stock à 72 ; une unité gramme est refusée pour un produit à l'unité, et une unité d'achat non dérivée aussi (422).
- **Échéancier** : un total différent du reste est refusé ; une échéance dépassée apparaît « En retard » ; la liste affiche « 4 000 FCFA en retard » et le filtre fonctionne ; après un paiement de 5 000 FCFA, la 1re échéance est payée et la 2e partielle (1 000) ; l'échéancier refait garde l'échéance payée ; un crédit client accepte toujours son échéancier (code commun) ; un vendeur est refusé (403).
- **Variantes** : la recherche renvoie 3 variantes et un code-barres exact une seule ; caisse : 2 Bissap + 1 Ananas = 2 800 FCFA, sans dépasser le stock ; la vente diminue le stock de chaque variante (Bissap 3 → 1, Ananas 12 → 11) et son annulation le rend ; stock insuffisant refusé avec le nom de la variante ; vente sans variante refusée ; approvisionnement de Gingembre (8 → 14, prix d'achat de la variante mis à jour) ; sortie de stock d'Ananas ; Mon stock affiche une ligne par variante ; soldes des mouvements par variante ; création à l'écran d'un produit à 2 variantes (codes `P-0062-1`, `P-0062-2`, stock à 0 partout) ; variante mise hors vente et absente de la caisse ; type non modifiable (422) ; total provisoire hors ligne au prix de la variante.
- Tous les scénarios de la phase repassent après les variantes. `npm run typecheck`, `npm run lint` et `npm run build` passent. L'avertissement sur la taille du paquet principal (plus de 500 Ko) existait déjà sur `main` (543 Ko, 552 Ko maintenant).

## Limites

- **Unité de vente** (mode avancé, §7.3) : la caisse vend toujours dans l'unité de base. Vendre « au carton » reste à faire.
- **Variantes** : pas de photo propre à une variante (la photo du produit sert pour toutes) ; un produit simple ne devient pas un produit à variantes (il faut en créer un nouveau) ; l'avertissement de stock faible utilise le seuil du produit pour chaque variante ; la vue « Toutes mes boutiques » de Mon stock affiche une ligne par variante, sans regroupement.
- **Échéances fournisseurs** : elles n'apparaissent pas sur le tableau de bord, qui ne montre que les échéances des clients.
- **Mot de passe oublié** : pas d'e-mail de confirmation après le changement (prévu par l'ancien GStock, F01.3), pas d'envoi par SMS ; la limitation du nombre de demandes est à faire côté serveur.
- **Photos** : sans réseau, une photo jamais affichée auparavant n'apparaît pas (le service worker ne met en cache que les réponses de l'API, pas les fichiers d'images du stockage objet).
- **Scan** : pas de lampe torche ni de choix de la caméra ; le lecteur WebAssembly (environ 1 Mo) est téléchargé à l'installation, même sur les téléphones qui ont un détecteur natif.
