# GStock — Design system (direction « Marché »)

Source de vérité visuelle de l'application commerçant. Tout écran, tout composant la respecte. Une page peut avoir des règles spécifiques dans `pages/<page>.md`, qui priment alors sur ce fichier. Maquette de référence : [`reference.html`](reference.html) (ouvrir dans un navigateur).

## Principe

Des **blocs de couleur francs, des contours épais et des ombres décalées**, comme les enseignes peintes des boutiques. L'application doit être reconnaissable au premier coup d'œil et rendre évident ce qui se touche. L'énergie vient de la forme ; la **retenue** vient de la règle : peu de couleurs vives par écran, une seule action principale.

Contexte d'usage à garder en tête : commerçant debout, smartphone Android d'entrée de gamme, souvent en plein soleil, gestes rapides, montants en FCFA à lire d'un coup d'œil.

## Couleurs

Thème clair uniquement pour l'instant (lisibilité en extérieur). Les variables sont définies dans `src/index.css` et suivent la convention shadcn ; chacune donne une classe Tailwind (`--action` → `bg-action`, `--paid-ink` → `text-paid-ink`…). Les composants n'utilisent **jamais** de valeur hexadécimale en dur. Attention : `accent` est réservé par shadcn aux survols de menus ; la mangue s'appelle `action`.

| Variable | Valeur | Usage |
|---|---|---|
| `--background` | `#FFF8EC` | Fond des écrans |
| `--card` | `#FFFFFF` | Cartes, champs, barre de navigation |
| `--foreground` | `#16133A` | Texte principal, contours, ombres décalées |
| `--muted-foreground` | `#575375` | Texte secondaire (contraste 7:1 sur le fond) |
| `--muted` | `#EDE6F7` | Fonds neutres, pistes de barres de progression |
| `--primary` | `#2B2A8C` | Indigo : navigation active, bouton « Vendre », boutons principaux |
| `--primary-foreground` | `#FFFFFF` | Texte sur indigo |
| `--action` | `#FF7A1A` | Mangue : **l'action principale de l'écran uniquement** (« Encaisser », « Valider ») et pastilles de quantité |
| `--action-foreground` | `#16133A` | Texte sur mangue (jamais blanc : contraste insuffisant) |

### Couleurs d'état (séparées de l'accent)

| Variable | Valeur | Usage |
|---|---|---|
| `--paid` | `#1F9D55` | Payé, remboursé : barres, pastilles, icônes. **Jamais pour du texte** (contraste 3,4:1) |
| `--paid-ink` | `#157A41` | Texte « Payé » |
| `--warn` | `#A34700` | Stock faible, échéance proche |
| `--warn-bg` | `#FFF1A8` | Fond d'alerte |
| `--destructive` | `#C0122B` | En retard, rupture, annulation, erreurs |
| `--destructive-bg` | `#FFE1E4` | Fond des badges de retard et des erreurs |

Un état se lit aussi par la forme (badge, libellé, icône), jamais par la couleur seule.

### Teintes de vignettes

Fonds pastel pour les vignettes produit et les catégories, attribués par catégorie (pas au hasard) : `#FFE3C7` (pêche), `#FFF1A8` (jaune), `#D7F0E0` (menthe), `#E6E1FA` (lavande). Icône par-dessus en `--foreground`. Une seule teinte pastel par carte.

## Typographie

Police unique : **Outfit** (Google Fonts, poids 400 à 800), repli `system-ui, sans-serif`.

| Rôle | Taille / poids | Notes |
|---|---|---|
| Titre d'écran | 28 px / 800, majuscules, `letter-spacing: -0.02em` | Seul endroit où les majuscules sont permises |
| Titre de section | 20 px / 700 | |
| Montant principal | 32 px / 700 | « Reste à payer », total d'une vente |
| Montant de carte / panier | 16–22 px / 700 | |
| Corps | 16 px / 400–500, interligne 1,5 | Jamais moins de 14 px pour du texte utile |
| Libellé, méta | 13–14 px / 600 | |
| Mini (unité FCFA, badges) | 11–12 px / 600–800 | |

### Montants

- Toujours des chiffres alignés (utilitaire `tabular`) ; utiliser le composant `<Money>`.
- Format : séparateur de milliers espace insécable fine, sans décimales à l'affichage (`10 350`), suivi de `FCFA` en plus petit et plus pâle. Le formatage est fait par une seule fonction dans `src/lib/` ; les montants viennent de l'API.
- Le montant est l'élément le plus visible d'une carte qui en contient un.

## Forme

| Variable | Valeur |
|---|---|
| `border-2 border-foreground` | contour de 2 px couleur encre |
| `shadow-hard` | `4px 4px 0` encre (cartes, panier) |
| `shadow-hard-sm` | `3px 3px 0` encre (boutons, bouton « Vendre ») |
| `rounded-sm` | `8px` (champs, puces, badges, vignettes) |
| `rounded-md` | `10px` (cartes produit, boutons) |
| `rounded-lg` | `12px` (cartes principales, panier) |
| `rounded-xl` | `14px` (bouton « Vendre » de la barre de navigation) |

**Signature tactile** : un élément touchable a un contour et une ombre décalée, via les utilitaires `pressable` (boutons) et `pressable-lg` (cartes). À l'appui, l'ombre disparaît et l'élément se décale de la même distance (`transform: translate(4px, 4px)`, `box-shadow: none`, 80 ms) : on a l'impression d'enfoncer un bouton physique. Un élément **non** touchable n'a **pas** d'ombre décalée.

## Espacement

Base 4 px. Échelle : 4, 8, 12, 16, 20, 24, 32. Marge latérale d'écran 16 px. Écart entre cartes 10–12 px.

## Icônes

Lucide (`lucide-react`), trait 2 px (2,4 px dans les boutons d'action), taille 20–24 px. Jamais d'emoji comme icône. Un bouton composé d'une icône seule a un `aria-label` en français.

## Composants de référence

- **Bouton principal (`variant="action"`)** : fond mangue, texte encre 800, `pressable` (contour + ombre 3 px), hauteur 50 px. Un seul par écran.
- **Bouton secondaire (`variant="default"`)** : fond indigo, texte blanc, `pressable` (contour + ombre 3 px), hauteur 48 px.
- **Bouton discret** : fond blanc, contour, sans ombre.
- **Champ** : fond blanc, contour 2 px, `rounded-sm`, hauteur 48 px, libellé visible au-dessus (jamais seulement un texte indicatif).
- **Puce de filtre** : contour, `--radius-sm`. Active : fond encre, texte fond.
- **Carte produit** : blanche, `pressable-lg`, vignette pastel, nom 14 px/700, prix, stock. Stock faible en `--warn` gras ; rupture : carte atténuée, libellé « Rupture de stock » en `--destructive`, non ajoutable au panier.
- **Pastille de quantité** : mangue, contour, en haut à droite de la carte.
- **Barre panier** (POS) : bloc indigo, `pressable-lg` (contour + ombre 4 px), nombre d'articles, total en gros, bouton « Encaisser ».
- **Badge d'état** : fond clair de l'état, texte de l'état, contour 2 px `currentColor`, `--radius-sm`.
- **Carte crédit client** : nom et téléphone, badge d'état, « Reste à payer » en montant principal, barre de progression (payé en vert), « Déjà payé / sur », dernier paiement, bouton « Recevoir un paiement ».

## Mise en page

- **Mobile (< 768 px)** : barre de navigation basse de 5 entrées maximum, « Vendre » au centre, surélevé, bloc indigo. Barre du haut : sélecteur de boutique (seulement si plusieurs boutiques) et avatar.
- **Desktop (≥ 1024 px)** : barre latérale à gauche, même ordre d'entrées, « Vendre » en bouton indigo en tête. Les listes passent de cartes à tableaux, mais une ligne reste cliquable.
- Points de contrôle : 360, 768, 1024, 1440 px. Jamais de défilement horizontal de la page.

## Animation

Discrète et utile : appui (80 ms), apparition de panneaux (150–200 ms, `ease-out`), ajout au panier (petit rebond de la pastille). Respecter `prefers-reduced-motion`. Pas de GSAP.

## Accessibilité

- Cibles tactiles ≥ 44 × 44 px (48 px visés pour les actions).
- Contraste texte ≥ 4,5:1 (toutes les paires ci-dessus le respectent, sauf le vert `--paid` réservé aux non-textes).
- Focus clavier visible : anneau 3 px `--primary` avec décalage 2 px.
- Chaque écran gère chargement (squelettes aux mêmes formes), erreur, vide et succès.

## Interdits

- Plusieurs boutons mangue sur un même écran ; l'orange comme couleur décorative.
- Ombres floues, dégradés, verre dépoli (glassmorphism), néon.
- Coins arrondis au-delà de 14 px (sauf pastilles rondes et avatars).
- Texte blanc sur mangue ; texte en vert `#1F9D55`.
- Majuscules hors titres d'écran.
- Thème shadcn par défaut (gris ardoise, Inter) : tous les composants shadcn sont rhabillés avec ces variables.
- Emoji en guise d'icônes.
