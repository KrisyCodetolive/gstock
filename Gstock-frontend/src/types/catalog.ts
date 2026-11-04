// Contrat d'API du module M06 : produits. Le catalogue est commun à l'espace,
// le stock est tenu par boutique, toujours dans l'unité de base (§7.2).
import type { Id, Money } from './api'
import type { CategoryColor } from './referentials'

/** `variable` (variantes) est prévu par le cahier en mode avancé, pas encore à l'écran. */
export type ProductType = 'simple' | 'variable' | 'service'

export type StockState = 'ok' | 'low' | 'out'

export interface ProductCategoryRef {
  id: Id
  name: string
  color: CategoryColor
}

export interface ProductUnitRef {
  id: Id
  name: string
  short_name: string
}

/** Unité utilisable pour un produit, avec sa conversion (§7.3). */
export interface ProductUnitOption extends ProductUnitRef {
  /** Nombre d'unités de base dans cette unité (Carton = 12 unités → "12.000"). */
  factor: string
}

/** Ressource /products */
export interface Product {
  id: Id
  type: ProductType
  name: string
  code: string
  barcode: string | null
  category: ProductCategoryRef | null
  brand: { id: Id; name: string } | null
  unit: ProductUnitRef
  /** Unité d'achat (mode avancé), null : on achète dans l'unité de base. */
  purchase_unit: ProductUnitOption | null
  /** Unité de base puis unités dérivées : celles proposées à l'approvisionnement. */
  units: ProductUnitOption[]
  /** Prix d'achat, par unité de base. */
  cost: Money | null
  price: Money
  tax_rate: string | null
  stock_alert: string | null
  image_url: string | null
  is_active: boolean
  /** Stock dans la boutique demandée (`?shop_id=`), null pour un service. */
  stock: ShopStockLevel | null
}

export interface ShopStockLevel {
  quantity: string
  stock_alert: string | null
  state: StockState
}

export interface ProductPayload {
  type: ProductType
  name: string
  /** Laisser vide : le serveur génère un code unique. */
  code: string | null
  barcode: string | null
  category_id: Id | null
  brand_id: Id | null
  unit_id: Id | null
  /** Unité d'achat : une unité dérivée de l'unité de base, ou null. */
  purchase_unit_id: Id | null
  cost: Money | null
  price: Money
  tax_rate: string | null
  stock_alert: string | null
  is_active: boolean
}

export interface ProductCreatePayload extends ProductPayload {
  /** Quantité de départ dans la boutique courante (crée un mouvement d'entrée). */
  initial_quantity?: string | null
  shop_id?: Id
}

/** GET /products/{id}/stock : le stock de chaque boutique. */
export interface ProductShopStock {
  shop: { id: Id; name: string; is_active: boolean }
  quantity: string
  stock_alert: string | null
  state: StockState
}

/** GET /shops/{shop_id}/products/search : résultat compact pour les sélecteurs (stock, caisse). */
export interface ProductSearchResult {
  id: Id
  type: ProductType
  name: string
  code: string
  barcode: string | null
  price: Money
  cost: Money | null
  unit: ProductUnitRef
  purchase_unit_id: Id | null
  units: ProductUnitOption[]
  category: ProductCategoryRef | null
  image_url: string | null
  quantity: string | null
  state: StockState | null
}
