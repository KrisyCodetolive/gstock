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

export type MovementSource =
  | 'opening'
  | 'adjustment'
  | 'adjustment_cancel'
  | 'sale'
  | 'sale_cancel'
  | 'purchase'
  | 'purchase_cancel'
  | 'transfer_out'
  | 'transfer_in'
  | 'transfer_cancel'
  | 'tracking_start'

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

/** Transfert entre boutiques (§7.12) : en route, reçu, ou annulé avant réception. */
export type TransferStatus = 'in_transit' | 'received' | 'cancelled'

/** GET /shops/{shop_id}/transfers : une ligne, vue depuis la boutique demandée. */
export interface TransferSummary {
  id: Id
  reference: string
  status: TransferStatus
  /** out : envoyé par cette boutique ; in : reçu par elle. */
  direction: 'out' | 'in'
  from_shop: { id: Id; name: string }
  to_shop: { id: Id; name: string }
  lines: number
  quantity: string
  sent_at: IsoDate
  sent_by: { id: Id; name: string } | null
  received_at: IsoDate | null
}

export interface TransferList {
  data: TransferSummary[]
  meta: { current_page: number; per_page: number; total: number; last_page: number }
  /** Transferts en route vers cette boutique. */
  summary: { to_receive: number }
}

/** GET /shops/{shop_id}/transfers/{id} : quantités en unité de base. */
export interface Transfer extends TransferSummary {
  items: {
    product: { id: Id; name: string; unit: ProductUnitRef }
    variant: { id: Id; name: string } | null
    quantity: string
    /** null tant que le transfert est en route. */
    received_quantity: string | null
    missing_quantity: string
    unit_cost: Money | null
  }[]
  note: string | null
  received_by: { id: Id; name: string } | null
  reception_note: string | null
  /** Valeur du manque au prix d'achat : comptée dans les pertes (§7.8). */
  missing_value: Money
  cancelled_at: IsoDate | null
  cancel_reason: string | null
}

/** POST /shops/{shop_id}/transfers : envoi depuis cette boutique. */
export interface TransferPayload {
  to_shop_id: Id
  items: { product_id: Id; variant_id?: Id | null; quantity: string }[]
  note?: string | null
}

/** POST /shops/{shop_id}/transfers/{id}/receive : par défaut, tout ce qui a été envoyé. */
export interface TransferReceivePayload {
  items: { product_id: Id; variant_id?: Id | null; received_quantity: string }[]
  note?: string | null
}
