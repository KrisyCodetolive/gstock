// Catalogue de démonstration (§11.3) : ~60 produits du quotidien, et leur stock
// de départ dans chaque boutique. Le stock est créé par des mouvements « stock
// initial », pour que quantité = somme des mouvements (§7.2).
import type { ProductType } from '@/types/catalog'
import { daysAgo } from './dates'

export interface MockVariant {
  id: number
  name: string
  code: string
  barcode: string | null
  cost: number | null
  price: number
  is_active: boolean
}

export interface MockProduct {
  id: number
  type: ProductType
  name: string
  code: string
  barcode: string | null
  category_id: number | null
  brand_id: number | null
  unit_id: number
  /** Unité d'achat (mode avancé) ; absente dans les bases créées avant son ajout. */
  purchase_unit_id?: number | null
  cost: number | null
  price: number
  tax_rate: number | null
  stock_alert: number | null
  image_url: string | null
  is_active: boolean
  /** Produit `variable` : ses variantes (le stock est tenu par variante). */
  variants?: MockVariant[]
}

export interface MockShopStock {
  shop_id: number
  product_id: number
  /** Variante d'un produit `variable` ; absente ou null sinon. */
  variant_id?: number | null
  quantity: number
  stock_alert: number | null
}

export interface MockMovement {
  id: number
  shop_id: number
  product_id: number
  variant_id?: number | null
  quantity: number
  unit_cost: number | null
  source_type: 'opening' | 'adjustment' | 'adjustment_cancel' | 'sale' | 'sale_cancel' | 'purchase' | 'purchase_cancel'
  source_id: number | null
  reference: string | null
  reason: string | null
  user_id: number | null
  occurred_at: string
}

export interface MockAdjustment {
  id: number
  shop_id: number
  reference: string
  kind: 'entry' | 'exit' | 'inventory'
  reason: string
  status: 'completed' | 'cancelled'
  items: { product_id: number; variant_id?: number | null; quantity: number; counted_quantity: number | null }[]
  user_id: number
  occurred_at: string
  offline_uuid: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

// [nom, catégorie, unité, prix d'achat, prix de vente, seuil, code-barres]
// Catégories : 1 Riz et céréales, 2 Huiles, 3 Boissons, 4 Savons et entretien,
// 5 Sucre et farine, 6 Lait et petit-déjeuner, 7 Conserves et condiments, 8 Hygiène.
// Unités : 1 Unité, 2 Paquet, 4 Bouteille, 5 Sachet, 6 Kilogramme, 8 Litre.
type Row = [string, number, number, number, number, number, string | null]

const ROWS: Row[] = [
  ['Riz parfumé 5 kg', 1, 1, 3900, 4500, 5, '6181100100015'],
  ['Riz parfumé 25 kg', 1, 1, 18500, 21000, 2, '6181100100022'],
  ['Riz local 1 kg', 1, 6, 450, 550, 10, null],
  ['Maïs en grains 1 kg', 1, 6, 250, 350, 10, null],
  ['Attiéké sachet', 1, 5, 150, 200, 15, null],
  ['Spaghetti 500 g', 1, 2, 300, 400, 12, '6181100100039'],
  ['Couscous 1 kg', 1, 2, 900, 1100, 6, null],
  ['Huile Dinor 1 L', 2, 4, 1150, 1350, 6, '6181100200012'],
  ['Huile Dinor 5 L', 2, 4, 5600, 6500, 3, '6181100200029'],
  ['Huile de palme 1 L', 2, 4, 700, 900, 6, null],
  ['Huile d’arachide 1 L', 2, 4, 1300, 1500, 4, null],
  ['Eau minérale 1,5 L', 3, 4, 250, 350, 24, '6181100300019'],
  ['Eau minérale pack de 6', 3, 2, 1400, 1800, 6, null],
  ['Coca-Cola 33 cl', 3, 1, 300, 400, 24, '5449000000996'],
  ['Fanta orange 33 cl', 3, 1, 300, 400, 24, '5449000011527'],
  ['Jus de bissap 1 L', 3, 4, 500, 700, 8, null],
  ['Bière Flag 65 cl', 3, 4, 500, 650, 24, null],
  ['Jus de gingembre 50 cl', 3, 4, 300, 500, 10, null],
  ['Savon de Marseille', 4, 1, 220, 300, 20, null],
  ['Savon Lux', 4, 1, 300, 400, 20, '8999999003553'],
  ['Lessive en poudre 500 g', 4, 2, 600, 800, 10, null],
  ['Eau de Javel 1 L', 4, 4, 400, 550, 8, null],
  ['Liquide vaisselle 500 ml', 4, 4, 550, 750, 6, null],
  ['Éponge à récurer', 4, 1, 100, 150, 15, null],
  ['Sucre en morceaux 1 kg', 5, 2, 750, 900, 10, '6181100500016'],
  ['Sucre en poudre 1 kg', 5, 6, 700, 850, 10, null],
  ['Farine de blé 1 kg', 5, 6, 550, 700, 8, null],
  ['Levure boulangère', 5, 5, 100, 150, 20, null],
  ['Lait en poudre 400 g', 6, 2, 2200, 2600, 6, '6181100600013'],
  ['Lait concentré sucré', 6, 1, 450, 600, 12, null],
  ['Café soluble 50 g', 6, 1, 1100, 1400, 6, null],
  ['Thé vert 25 sachets', 6, 2, 500, 700, 8, null],
  ['Chocolat en poudre 400 g', 6, 2, 1800, 2200, 4, null],
  ['Pain de mie', 6, 1, 600, 800, 5, null],
  ['Biscuits secs', 6, 2, 150, 200, 20, null],
  ['Tomate concentrée 70 g', 7, 1, 75, 100, 40, null],
  ['Tomate concentrée 400 g', 7, 1, 450, 600, 10, null],
  ['Cube Maggi (boîte de 100)', 7, 2, 1800, 2200, 4, '7613036000000'],
  ['Sardines à l’huile', 7, 1, 400, 550, 12, null],
  ['Mayonnaise 250 g', 7, 4, 800, 1050, 5, null],
  ['Sel fin 1 kg', 7, 2, 200, 300, 10, null],
  ['Piment en poudre', 7, 5, 150, 250, 10, null],
  ['Moutarde 200 g', 7, 4, 600, 800, 4, null],
  ['Dentifrice 75 ml', 8, 1, 500, 700, 8, null],
  ['Brosse à dents', 8, 1, 250, 400, 10, null],
  ['Papier toilette (4 rouleaux)', 8, 2, 700, 1000, 6, null],
  ['Serviettes hygiéniques', 8, 2, 600, 850, 8, null],
  ['Couches bébé (paquet de 30)', 8, 2, 3800, 4500, 3, null],
  ['Crème de beauté 250 ml', 8, 4, 1200, 1600, 4, null],
  ['Allumettes (paquet de 10)', 4, 2, 100, 150, 10, null],
  ['Bougies (paquet de 6)', 4, 2, 400, 600, 6, null],
  ['Piles AA (lot de 4)', 4, 2, 600, 900, 5, null],
  ['Charbon de bois sac', 4, 1, 2500, 3200, 3, null],
  ['Gaz butane 6 kg (recharge)', 4, 1, 4500, 5000, 2, null],
  ['Œufs (plateau de 30)', 6, 1, 2700, 3200, 3, null],
  ['Oignons 1 kg', 7, 6, 500, 700, 8, null],
  ['Ail en tête', 7, 1, 100, 150, 15, null],
  ['Arachides grillées sachet', 1, 5, 75, 100, 20, null],
  ['Vinaigre 1 L', 7, 4, 450, 600, 4, null],
]

// Stock de départ (Cocody, Yopougon). Quelques produits faibles ou en rupture
// pour les alertes ; un produit n'est vendu qu'à Cocody.
export const STOCK_FIXED: Record<string, [number, number]> = {
  'Riz parfumé 5 kg': [24, 18],
  'Huile Dinor 1 L': [3, 14],
  'Savon de Marseille': [0, 25],
  'Sucre en morceaux 1 kg': [40, 9],
  'Lait en poudre 400 g': [5, 0],
  'Cube Maggi (boîte de 100)': [2, 6],
  'Gaz butane 6 kg (recharge)': [1, 3],
  'Couches bébé (paquet de 30)': [0, 2],
  'Coca-Cola 33 cl': [72, 48],
  'Bière Flag 65 cl': [36, 0],
}

/** Quantité pseudo-aléatoire mais stable d'une démo à l'autre. */
function defaultStock(index: number, shop: number, alert: number): number {
  const n = ((index + 3) * (shop === 1 ? 37 : 53)) % 41
  return alert + (n % (alert * 3 + 5))
}

/** Codes EAN-13 valides : le dernier chiffre est la clé de contrôle, vérifiée par les lecteurs. */
function ean13(code: string): string {
  const digits = code.slice(0, 12).split('').map(Number)
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 ? 3 : 1), 0)
  return code.slice(0, 12) + String((10 - (sum % 10)) % 10)
}

const CARTON = new Set(['Coca-Cola 33 cl', 'Fanta orange 33 cl', 'Savon de Marseille', 'Savon Lux'])

export const products: MockProduct[] = ROWS.map(([name, category, unit, cost, price, alert, barcode], i) => ({
  id: i + 1,
  type: 'simple',
  name,
  code: `P-${String(i + 1).padStart(4, '0')}`,
  barcode: barcode && barcode.length === 13 ? ean13(barcode) : barcode,
  category_id: category,
  brand_id: name.startsWith('Huile Dinor') ? 1 : null,
  unit_id: unit,
  // Boissons et savons s'achètent au carton de 12 (unité 3).
  purchase_unit_id: CARTON.has(name) ? 3 : null,
  cost,
  price,
  tax_rate: null,
  stock_alert: alert,
  image_url: null,
  is_active: true,
}))

// Un service : pas de stock (§7.2).
products.push({
  id: products.length + 1,
  type: 'service',
  name: 'Livraison à domicile',
  code: `P-${String(products.length + 1).padStart(4, '0')}`,
  barcode: null,
  category_id: null,
  brand_id: null,
  unit_id: 1,
  cost: null,
  price: 500,
  tax_rate: null,
  stock_alert: null,
  image_url: null,
  is_active: true,
})

// Un produit à variantes (mode avancé) : chaque parfum a son prix et son stock.
{
  const id = products.length + 1
  const code = `P-${String(id).padStart(4, '0')}`
  products.push({
    id,
    type: 'variable',
    name: 'Jus de fruits 1 L',
    code,
    barcode: null,
    category_id: 3,
    brand_id: null,
    unit_id: 4,
    purchase_unit_id: null,
    cost: 600,
    price: 900,
    tax_rate: null,
    stock_alert: 4,
    image_url: null,
    is_active: true,
    variants: [
      { id: 1, name: 'Ananas', code: `${code}-1`, barcode: ean13('618110090001'), cost: 700, price: 1000, is_active: true },
      { id: 2, name: 'Bissap', code: `${code}-2`, barcode: ean13('618110090002'), cost: 600, price: 900, is_active: true },
      { id: 3, name: 'Gingembre', code: `${code}-3`, barcode: ean13('618110090003'), cost: 600, price: 900, is_active: true },
    ],
  })
}

// Stock de départ saisi un peu plus d'un mois avant aujourd'hui.
const OPENING_DATE = daysAgo(34, 8)

export const shopStock: MockShopStock[] = []
export const movements: MockMovement[] = []

products
  .filter((p) => p.type === 'simple')
  .forEach((p, index) => {
    for (const shopId of [1, 2]) {
      const fixed = STOCK_FIXED[p.name]
      const quantity = fixed ? fixed[shopId - 1]! : defaultStock(index, shopId, p.stock_alert ?? 5)
      shopStock.push({ shop_id: shopId, product_id: p.id, quantity, stock_alert: null })
      if (quantity > 0) {
        movements.push({
          id: movements.length + 1,
          shop_id: shopId,
          product_id: p.id,
          quantity,
          unit_cost: p.cost,
          source_type: 'opening',
          source_id: null,
          reference: null,
          reason: 'Stock initial',
          user_id: 1,
          occurred_at: OPENING_DATE,
        })
      }
    }
  })

// Stock de départ des variantes, boutique par boutique.
for (const p of products.filter((x) => x.type === 'variable')) {
  p.variants!.forEach((variant, index) => {
    for (const shopId of [1, 2]) {
      const quantity = [[12, 6], [3, 10], [8, 0]][index]![shopId - 1]!
      shopStock.push({ shop_id: shopId, product_id: p.id, variant_id: variant.id, quantity, stock_alert: null })
      if (quantity > 0) {
        movements.push({
          id: movements.length + 1,
          shop_id: shopId,
          product_id: p.id,
          variant_id: variant.id,
          quantity,
          unit_cost: variant.cost,
          source_type: 'opening',
          source_id: null,
          reference: null,
          reason: 'Stock initial',
          user_id: 1,
          occurred_at: OPENING_DATE,
        })
      }
    }
  })
}

export const adjustments: MockAdjustment[] = []

/** Catégories ajoutées au jeu de démonstration pour le catalogue. */
export const extraCategories = [
  { id: 6, name: 'Lait et petit-déjeuner', color: 'mint' as const, is_active: true },
  { id: 7, name: 'Conserves et condiments', color: 'yellow' as const, is_active: true },
  { id: 8, name: 'Hygiène', color: 'lavender' as const, is_active: true },
]
