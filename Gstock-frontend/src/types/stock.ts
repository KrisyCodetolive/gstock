// Contrat d'API du module M07 : stock d'une boutique, mouvements, ajustements.
import type { Id, IsoDate, Money } from './api'
import type { ProductCategoryRef, ProductUnitRef, StockState } from './catalog'

/** GET /shops/{shop_id}/stock : une ligne par produit stockable. */
export interface StockItem {
  product: {
    id: Id
    name: string
    code: string
    category: ProductCategoryRef | null
    unit: ProductUnitRef
    is_active: boolean
  }
  quantity: string
  stock_alert: string | null
  cost: Money | null
  /** quantité × prix d'achat, calculée par le serveur. */
  value: Money | null
  state: StockState
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
}

/** GET /stock : vue « Toutes mes boutiques » (propriétaire). */
export interface StockOverviewItem {
  product: StockItem['product']
  total: string
  shops: { shop_id: Id; quantity: string; state: StockState }[]
}

export type MovementSource = 'opening' | 'adjustment' | 'adjustment_cancel' | 'sale' | 'sale_cancel' | 'purchase' | 'purchase_cancel'

/** GET /shops/{shop_id}/stock/movements */
export interface StockMovement {
  id: Id
  product: { id: Id; name: string; unit: ProductUnitRef }
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
  /** Entrée, sortie : quantité saisie. Inventaire : écart appliqué. */
  quantity: string
  /** Inventaire seulement : quantité comptée. */
  counted_quantity: string | null
}

/** Ressource /shops/{shop_id}/adjustments, référence MS-N. */
export interface Adjustment {
  id: Id
  reference: string
  kind: AdjustmentKind
  reason: string
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
  items: { product_id: Id; quantity?: string; counted_quantity?: string }[]
  /** Idempotence hors ligne (ADR-005). */
  offline_uuid?: string
}
