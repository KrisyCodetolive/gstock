// Illustrations des produits de démonstration, dessinées en SVG dans le style
// « Marché » (MASTER.md) : emballage à contour épais, ombre décalée, teinte de la
// catégorie en fond. Elles ne vivent que dans les données simulées : le build de
// production n'en contient aucune.

type Shape =
  | 'bag'
  | 'bottle'
  | 'jerrycan'
  | 'can'
  | 'box'
  | 'sachet'
  | 'jar'
  | 'tube'
  | 'bar'
  | 'roll'
  | 'loaf'
  | 'eggs'
  | 'bulbs'
  | 'stick'
  | 'cylinder'

interface Spec {
  shape: Shape
  /** Couleur de l'emballage. */
  color: string
  /** Mot principal de l'étiquette, en capitales. */
  label: string
  /** Contenance ou précision, sous l'étiquette. */
  sub?: string
  /** Couleur du texte de l'étiquette (blanc par défaut sur fond foncé). */
  ink?: string
}

const INK = '#16133a'
const TINT: Record<number, string> = {
  1: '#ffe3c7',
  2: '#fff1a8',
  3: '#d7f0e0',
  4: '#e6e1fa',
  5: '#ffe3c7',
  6: '#d7f0e0',
  7: '#fff1a8',
  8: '#e6e1fa',
}

/**
 * Silhouette (`body`, qui reçoit la couleur et l'ombre), détails par-dessus,
 * et zone de l'étiquette (centre et largeur utile).
 */
function shape(kind: Shape, color: string): { body: string; details: string; label: { x: number; y: number; w: number } } {
  const s = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`
  switch (kind) {
    case 'bag':
      return {
        body: `<path d="M24 26 L76 26 L82 88 Q82 92 78 92 L22 92 Q18 92 18 88 Z"/>`,
        details: `<path d="M24 26 L30 16 L70 16 L76 26" fill="${color}" ${s}/><path d="M30 16 L36 26 M42 16 L46 26 M54 16 L54 26 M66 16 L64 26" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 60, w: 52 },
      }
    case 'bottle':
      return {
        body: `<path d="M42 22 L58 22 L58 34 Q72 40 72 54 L72 88 Q72 92 68 92 L32 92 Q28 92 28 88 L28 54 Q28 40 42 34 Z"/>`,
        details: `<rect x="40" y="10" width="20" height="12" rx="2" fill="${INK}"/>`,
        label: { x: 50, y: 68, w: 40 },
      }
    case 'jerrycan':
      return {
        body: `<path d="M22 30 Q22 24 28 24 L58 24 L78 40 L78 88 Q78 92 74 92 L26 92 Q22 92 22 88 Z"/>`,
        details: `<rect x="62" y="12" width="12" height="12" rx="2" fill="${INK}"/><path d="M30 24 L30 16 L50 16 L50 24" fill="none" ${s}/>`,
        label: { x: 50, y: 64, w: 48 },
      }
    case 'can':
      return {
        body: `<path d="M30 20 Q50 14 70 20 L70 86 Q50 92 30 86 Z"/>`,
        details: `<path d="M30 20 Q50 26 70 20" fill="none" ${s}/><path d="M30 30 Q50 36 70 30 M30 76 Q50 82 70 76" fill="none" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 56, w: 38 },
      }
    case 'box':
      return {
        body: `<rect x="20" y="22" width="60" height="70" rx="3"/>`,
        details: `<path d="M20 34 L80 34" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 64, w: 50 },
      }
    case 'sachet':
      return {
        body: `<path d="M24 22 L30 16 L36 22 L42 16 L48 22 L54 16 L60 22 L66 16 L72 22 L76 22 L76 90 L24 90 Z"/>`,
        details: `<path d="M24 30 L76 30" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/>`,
        label: { x: 50, y: 62, w: 46 },
      }
    case 'jar':
      return {
        body: `<path d="M28 34 Q24 34 24 40 L24 86 Q24 92 30 92 L70 92 Q76 92 76 86 L76 40 Q76 34 72 34 Z"/>`,
        details: `<rect x="30" y="18" width="40" height="16" rx="3" fill="${INK}"/>`,
        label: { x: 50, y: 64, w: 46 },
      }
    case 'tube':
      return {
        body: `<path d="M24 20 L76 20 L66 82 L34 82 Z"/>`,
        details: `<rect x="42" y="82" width="16" height="10" rx="2" fill="${INK}"/><path d="M24 26 L76 26" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 52, w: 40 },
      }
    case 'bar':
      return {
        body: `<rect x="14" y="36" width="72" height="40" rx="12"/>`,
        details: `<rect x="22" y="44" width="56" height="24" rx="8" fill="none" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 61, w: 46 },
      }
    case 'roll':
      return {
        body: `<path d="M14 40 L50 40 L50 86 L14 86 Z M50 40 L86 40 L86 86 L50 86 Z"/>`,
        details: `<path d="M14 40 Q32 32 50 40 Q68 32 86 40" fill="#ffffff" ${s}/>`,
        label: { x: 50, y: 66, w: 64 },
      }
    case 'loaf':
      return {
        body: `<path d="M16 50 Q16 26 36 26 Q44 18 50 26 Q56 18 64 26 Q84 26 84 50 L84 86 Q84 90 80 90 L20 90 Q16 90 16 86 Z"/>`,
        details: `<path d="M34 34 Q36 44 32 50 M50 30 Q52 42 48 50 M66 34 Q68 44 64 50" fill="none" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 72, w: 58 },
      }
    case 'eggs':
      return {
        body: `<rect x="12" y="56" width="76" height="30" rx="4"/>`,
        details: [24, 42, 60, 78]
          .map((x, i) => `<ellipse cx="${x - 2}" cy="${i % 2 ? 48 : 46}" rx="9" ry="12" fill="#fff6e8" ${s}/>`)
          .join(''),
        label: { x: 50, y: 72, w: 64 },
      }
    case 'bulbs':
      return {
        body: `<circle cx="34" cy="62" r="20"/><circle cx="64" cy="58" r="22"/>`,
        details: `<path d="M34 42 L34 32 M64 36 L64 24" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M34 46 Q28 62 34 80 M64 40 Q57 58 64 78" fill="none" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 92, w: 0 },
      }
    case 'stick':
      return {
        body: `<rect x="40" y="14" width="20" height="78" rx="4"/>`,
        details: `<path d="M50 14 L50 6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
        label: { x: 50, y: 56, w: 0 },
      }
    case 'cylinder':
      return {
        body: `<path d="M26 32 Q26 24 34 24 L66 24 Q74 24 74 32 L74 86 Q74 92 68 92 L32 92 Q26 92 26 86 Z"/>`,
        details: `<rect x="42" y="12" width="16" height="12" rx="2" fill="${INK}"/><path d="M26 42 L74 42 M26 76 L74 76" stroke="${INK}" stroke-width="2"/>`,
        label: { x: 50, y: 60, w: 42 },
      }
  }
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function render(spec: Spec, categoryId: number | null): string {
  const tint = TINT[categoryId ?? 4] ?? TINT[4]!
  const { body, details, label } = shape(spec.shape, spec.color)
  const ink = spec.ink ?? '#ffffff'
  // Étiquette : rectangle blanc ou texte direct selon la place disponible.
  // Taille du texte : 14 au plus, réduite pour que le mot tienne dans l'étiquette.
  const size = Math.min(14, Math.floor((label.w / (spec.label.length * 0.68)) * 10) / 10)
  const text =
    label.w > 0
      ? `<text x="${label.x}" y="${label.y}" text-anchor="middle" font-family="Outfit, Arial, sans-serif" font-weight="800" font-size="${size}" fill="${ink}">${escape(spec.label)}</text>` +
        (spec.sub
          ? `<text x="${label.x}" y="${label.y + 13}" text-anchor="middle" font-family="Outfit, Arial, sans-serif" font-weight="600" font-size="10" fill="${ink}">${escape(spec.sub)}</text>`
          : '')
      : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${tint}"/>` +
    `<g fill="${INK}" transform="translate(4 4)">${body}</g>` +
    `<g fill="${spec.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round">${body}</g>` +
    details +
    text +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Une illustration par produit de démonstration (nom exact). */
const SPECS: Record<string, Spec> = {
  'Riz parfumé 5 kg': { shape: 'bag', color: '#2b2a8c', label: 'RIZ', sub: '5 kg' },
  'Riz parfumé 25 kg': { shape: 'bag', color: '#c0392b', label: 'RIZ', sub: '25 kg' },
  'Riz local 1 kg': { shape: 'sachet', color: '#f4e4c1', label: 'RIZ', sub: 'local', ink: INK },
  'Maïs en grains 1 kg': { shape: 'sachet', color: '#f2b705', label: 'MAÏS', sub: '1 kg', ink: INK },
  'Attiéké sachet': { shape: 'sachet', color: '#ffffff', label: 'ATTIÉKÉ', ink: INK },
  'Spaghetti 500 g': { shape: 'box', color: '#1f6fb2', label: 'PÂTES', sub: '500 g' },
  'Couscous 1 kg': { shape: 'box', color: '#e8a33d', label: 'COUSCOUS', sub: '1 kg', ink: INK },
  'Huile Dinor 1 L': { shape: 'bottle', color: '#f6c445', label: 'HUILE', sub: '1 L', ink: INK },
  'Huile Dinor 5 L': { shape: 'jerrycan', color: '#f6c445', label: 'HUILE', sub: '5 L', ink: INK },
  'Huile de palme 1 L': { shape: 'bottle', color: '#c2410c', label: 'PALME', sub: '1 L' },
  'Huile d’arachide 1 L': { shape: 'bottle', color: '#d9a441', label: 'ARACHIDE', sub: '1 L', ink: INK },
  'Eau minérale 1,5 L': { shape: 'bottle', color: '#9fd3f0', label: 'EAU', sub: '1,5 L', ink: INK },
  'Eau minérale pack de 6': { shape: 'box', color: '#9fd3f0', label: 'EAU', sub: '6 × 1,5 L', ink: INK },
  'Coca-Cola 33 cl': { shape: 'can', color: '#d62828', label: 'COLA', sub: '33 cl' },
  'Fanta orange 33 cl': { shape: 'can', color: '#ff7a1a', label: 'ORANGE', sub: '33 cl', ink: INK },
  'Jus de bissap 1 L': { shape: 'bottle', color: '#7a1f3d', label: 'BISSAP', sub: '1 L' },
  'Bière Flag 65 cl': { shape: 'bottle', color: '#2f7d32', label: 'BIÈRE', sub: '65 cl' },
  'Jus de gingembre 50 cl': { shape: 'bottle', color: '#e9c46a', label: 'GINGEMBRE', sub: '50 cl', ink: INK },
  'Savon de Marseille': { shape: 'bar', color: '#a7c957', label: 'SAVON', ink: INK },
  'Savon Lux': { shape: 'bar', color: '#f4a6c1', label: 'SAVON', ink: INK },
  'Lessive en poudre 500 g': { shape: 'box', color: '#3a86ff', label: 'LESSIVE', sub: '500 g' },
  'Eau de Javel 1 L': { shape: 'bottle', color: '#ffffff', label: 'JAVEL', sub: '1 L', ink: INK },
  'Liquide vaisselle 500 ml': { shape: 'bottle', color: '#52b788', label: 'VAISSELLE', sub: '500 ml' },
  'Éponge à récurer': { shape: 'bar', color: '#ffd166', label: 'ÉPONGE', ink: INK },
  'Sucre en morceaux 1 kg': { shape: 'box', color: '#ffffff', label: 'SUCRE', sub: 'morceaux', ink: INK },
  'Sucre en poudre 1 kg': { shape: 'sachet', color: '#ffffff', label: 'SUCRE', sub: '1 kg', ink: INK },
  'Farine de blé 1 kg': { shape: 'bag', color: '#f1e3c6', label: 'FARINE', sub: '1 kg', ink: INK },
  'Levure boulangère': { shape: 'sachet', color: '#e76f51', label: 'LEVURE' },
  'Lait en poudre 400 g': { shape: 'cylinder', color: '#2b2a8c', label: 'LAIT', sub: '400 g' },
  'Lait concentré sucré': { shape: 'can', color: '#ffffff', label: 'LAIT', sub: 'sucré', ink: INK },
  'Café soluble 50 g': { shape: 'jar', color: '#6f4518', label: 'CAFÉ', sub: '50 g' },
  'Thé vert 25 sachets': { shape: 'box', color: '#2d6a4f', label: 'THÉ', sub: '25 sachets' },
  'Chocolat en poudre 400 g': { shape: 'cylinder', color: '#7b3f00', label: 'CACAO', sub: '400 g' },
  'Pain de mie': { shape: 'loaf', color: '#e9b872', label: 'PAIN', ink: INK },
  'Biscuits secs': { shape: 'box', color: '#f4a261', label: 'BISCUITS', ink: INK },
  'Tomate concentrée 70 g': { shape: 'sachet', color: '#d62828', label: 'TOMATE', sub: '70 g' },
  'Tomate concentrée 400 g': { shape: 'can', color: '#d62828', label: 'TOMATE', sub: '400 g' },
  'Cube Maggi (boîte de 100)': { shape: 'box', color: '#f6c445', label: 'CUBES', sub: '× 100', ink: INK },
  'Sardines à l’huile': { shape: 'bar', color: '#457b9d', label: 'SARDINES' },
  'Mayonnaise 250 g': { shape: 'jar', color: '#fff3b0', label: 'MAYO', sub: '250 g', ink: INK },
  'Sel fin 1 kg': { shape: 'cylinder', color: '#a8dadc', label: 'SEL', sub: '1 kg', ink: INK },
  'Piment en poudre': { shape: 'sachet', color: '#b5179e', label: 'PIMENT' },
  'Moutarde 200 g': { shape: 'jar', color: '#e9c46a', label: 'MOUTARDE', sub: '200 g', ink: INK },
  'Dentifrice 75 ml': { shape: 'tube', color: '#4cc9f0', label: 'DENTIFRICE', sub: '75 ml', ink: INK },
  'Brosse à dents': { shape: 'stick', color: '#3a86ff', label: '' },
  'Papier toilette (4 rouleaux)': { shape: 'roll', color: '#ffffff', label: 'PAPIER', sub: '× 4', ink: INK },
  'Serviettes hygiéniques': { shape: 'box', color: '#cdb4db', label: 'SERVIETTES', ink: INK },
  'Couches bébé (paquet de 30)': { shape: 'bag', color: '#90e0ef', label: 'COUCHES', sub: '× 30', ink: INK },
  'Crème de beauté 250 ml': { shape: 'jar', color: '#ffc8dd', label: 'CRÈME', sub: '250 ml', ink: INK },
  'Allumettes (paquet de 10)': { shape: 'box', color: '#e63946', label: 'ALLUMETTES', sub: '× 10' },
  'Bougies (paquet de 6)': { shape: 'stick', color: '#ffffff', label: '' },
  'Piles AA (lot de 4)': { shape: 'cylinder', color: '#2b2d42', label: 'PILES', sub: 'AA × 4' },
  'Charbon de bois sac': { shape: 'bag', color: '#3d3d3d', label: 'CHARBON' },
  'Gaz butane 6 kg (recharge)': { shape: 'cylinder', color: '#2a9d8f', label: 'GAZ', sub: '6 kg' },
  'Œufs (plateau de 30)': { shape: 'eggs', color: '#d4a373', label: '30 ŒUFS', ink: INK },
  'Oignons 1 kg': { shape: 'bulbs', color: '#c77dff', label: '' },
  'Ail en tête': { shape: 'bulbs', color: '#f8f9fa', label: '' },
  'Arachides grillées sachet': { shape: 'sachet', color: '#bc6c25', label: 'ARACHIDES' },
  'Vinaigre 1 L': { shape: 'bottle', color: '#e9edc9', label: 'VINAIGRE', sub: '1 L', ink: INK },
  'Jus de fruits 1 L': { shape: 'bottle', color: '#ff9f1c', label: 'JUS', sub: '1 L', ink: INK },
}

/** Illustration d'un produit de démonstration, ou null s'il n'en a pas (le service, par exemple). */
export function demoProductImage(name: string, categoryId: number | null): string | null {
  const spec = SPECS[name]
  return spec ? render(spec, categoryId) : null
}
