// Contrat d'API du module M07 : stock d'une boutique, mouvements, ajustements.
import type { Id, IsoDate, Money } from './api'
import type { ExpiryState, ExpirySummary, ProductCategoryRef, ProductUnitRef, StockState } from './catalog'

/** GET /shops/{shop_id}/stock : une ligne par produit stockable. */
/** Une ligne par article : un produit, ou une variante (`variant`, et `product.name` avec la variante). */
export interface StockItem {
  variant: { id: Id; name: string } | null
  product: {
    id: Id
    name: string
    code: string
    category: ProductCategoryRef | null
    unit: ProductUnitRef
    image_url: string | null
    is_active: boolean
  }
  quantity: string
  stock_alert: string | null
  cost: Money | null
  /** quantité × prix d'achat, calculée par le serveur. */
  value: Money | null
  state: StockState
  /** Produit suivi : péremption dans la boutique (§7.11) ; null sinon. */
  expiry?: ExpirySummary | null
}

export interface StockList {
  data: StockItem[]
  meta: { current_page: number; per_page: number; total: number; last_page: number }
  summary: StockSummary
}

/** Totaux de la boutique, indépendants de la page affichée. */
export interface StockSummary {
  products: number
  low: number
  out: number
  /** Valeur estimée du stock au prix d'achat. */
  value: Money
  /** Articles qui ont des arrivages périmés / bientôt périmés (§7.11). */
  expired?: number
  soon?: number
}

/** GET /shops/{shop_id}/stock/lots?product_id=&variant_id= : arrivages en stock, dans l'ordre de sortie. */
export interface StockLot {
  id: Id
  expiry_date: string | null
  state: ExpiryState
  quantity: string
  initial_quantity: string
  source_type: string
  reference: string | null
  received_at: IsoDate
}

/** Motif d'une sortie (§7.11) ; périmé, cassé et volé sont des pertes (§7.8). */
export type ExitReason = 'expired' | 'damaged' | 'stolen' | 'consumed' | 'other'

/** GET /stock : vue « Toutes mes boutiques » (propriétaire). */
export interface StockOverviewItem {
  variant: StockItem['variant']
  product: StockItem['product']
  total: string
  shops: { shop_id: Id; quantity: string; state: StockState }[]
}

export type MovementSource = 'opening' | 'adjustment' | 'adjustment_cancel' | 'sale' | 'sale_cancel' | 'purchase' | 'purchase_cancel'

/** GET /shops/{shop_id}/stock/movements */
export interface StockMovement {
  id: Id
  product: { id: Id; name: string; unit: ProductUnitRef }
  variant: { id: Id; name: string } | null
  /** Signée : positive pour une entrée, négative pour une sortie. */
  quantity: string
  /** Stock après le mouvement. */
  balance: string
  source_type: MovementSource
  source_id: Id | null
  reference: string | null
  reason: string | null
  user: { id: Id; name: string } | null
  occurred_at: IsoDate
}

export type AdjustmentKind = 'entry' | 'exit' | 'inventory'
export type AdjustmentStatus = 'completed' | 'cancelled'

export interface AdjustmentItem {
  product: { id: Id; name: string; unit: ProductUnitRef }
  variant: { id: Id; name: string } | null
  /** Entrée, sortie : quantité saisie. Inventaire : écart appliqué. */
  quantity: string
  /** Inventaire seulement : quantité comptée. */
  counted_quantity: string | null
  expiry_date?: string | null
  stock_lot_id?: Id | null
}

/** Ressource /shops/{shop_id}/adjustments, référence MS-N. */
export interface Adjustment {
  id: Id
  reference: string
  kind: AdjustmentKind
  reason: string
  exit_reason?: ExitReason | null
  status: AdjustmentStatus
  items: AdjustmentItem[]
  user: { id: Id; name: string } | null
  occurred_at: IsoDate
  cancelled_at: IsoDate | null
  cancel_reason: string | null
}

export interface AdjustmentPayload {
  kind: AdjustmentKind
  reason: string
  /** Sortie : motif choisi dans la liste (§7.11). */
  exit_reason?: ExitReason
  items: {
    product_id: Id
    variant_id?: Id | null
    quantity?: string
    counted_quantity?: string
    /** Entrée ou inventaire d'un produit suivi : date de péremption (Y-m-d), facultative. */
    expiry_date?: string | null
    /** Sortie d'un arrivage précis (sortie « Périmé »). */
    stock_lot_id?: Id | null
  }[]
  /** Idempotence hors ligne (ADR-005). */
  offline_uuid?: string
}
