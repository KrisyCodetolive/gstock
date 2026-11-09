// Contrat d'API du module M06 : produits. Le catalogue est commun à l'espace,
// le stock est tenu par boutique, toujours dans l'unité de base (§7.2).
import type { Id, Money } from './api'
import type { CategoryColor } from './referentials'

/** `variable` : produit à variantes (taille, parfum…), chacune avec son prix et son stock (mode avancé). */
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

/** Variante d'un produit `variable` : son propre prix, son propre stock par boutique. */
export interface ProductVariant {
  id: Id
  /** Ce qui distingue la variante : « Bissap », « Taille M »… */
  name: string
  /** Généré par le serveur : code du produit suivi d'un numéro (P-0061-1). */
  code: string
  barcode: string | null
  cost: Money | null
  price: Money
  /** Une variante ne se supprime pas : elle se désactive (plus proposée à la vente). */
  is_active: boolean
}

export interface ProductVariantPayload {
  /** Absent : nouvelle variante. */
  id?: Id
  name: string
  barcode: string | null
  cost: string | null
  price: string
  is_active: boolean
  /** Création seulement : stock de départ de la variante dans la boutique courante. */
  initial_quantity?: string | null
  /** Création d'un produit suivi : date de péremption de ce stock (Y-m-d), facultative. */
  initial_expiry_date?: string | null
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
  /** Dates de péremption suivies (§7.11). Absent des données simulées. */
  track_expiry?: boolean
  /** Délai d'alerte propre au produit, en jours ; null : celui de l'espace. */
  expiry_alert_days?: number | null
  /** Stock dans la boutique demandée (`?shop_id=`), null pour un service. Variantes : total. */
  stock: ShopStockLevel | null
  /** Produit `variable` : ses variantes ; vide sinon. `price` est alors le plus bas prix des variantes. */
  variants: ProductVariant[]
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
  track_expiry?: boolean
  expiry_alert_days?: number | null
  /** Produit `variable` : toutes ses variantes (au moins une active). Le type ne change plus après la création. */
  variants?: ProductVariantPayload[]
}

export interface ProductCreatePayload extends ProductPayload {
  /** Quantité de départ dans la boutique courante (crée un mouvement d'entrée). */
  initial_quantity?: string | null
  /** Produit suivi : date de péremption de la quantité initiale (Y-m-d), facultative. */
  initial_expiry_date?: string | null
  shop_id?: Id
}

/** État d'un arrivage (§7.11) : périmé dès le jour de sa date. */
export type ExpiryState = 'expired' | 'soon' | 'ok' | 'undated'

/** Péremption d'un article dans une boutique : null si le produit n'est pas suivi. */
export interface ExpirySummary {
  expired_quantity: string
  /** Plus ancienne date dépassée (Y-m-d). */
  expired_since: string | null
  soon_quantity: string
  /** Prochaine date à venir (Y-m-d). */
  next_expiry_date: string | null
  undated_quantity: string
}

/** GET /products/{id}/stock : le stock de chaque boutique (variantes : total, puis détail). */
export interface ProductShopStock {
  shop: { id: Id; name: string; is_active: boolean }
  quantity: string
  stock_alert: string | null
  state: StockState
  variants: { id: Id; name: string; quantity: string; state: StockState }[]
}

/**
 * GET /shops/{shop_id}/products/search : résultat compact pour les sélecteurs (stock, caisse).
 * Un produit à variantes donne une entrée par variante active : `name` vaut alors
 * « Produit — Variante », et prix, code-barres et stock sont ceux de la variante.
 */
export interface ProductSearchResult {
  id: Id
  /** null pour un produit sans variantes. */
  variant_id: Id | null
  variant_name: string | null
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
  track_expiry?: boolean
  expiry?: ExpirySummary | null
  /** Recherche filtrée par fournisseur : dernière unité et dernier prix de la ligne achetés chez lui. */
  supplier_last?: { unit_id: Id | null; cost: Money }
}
