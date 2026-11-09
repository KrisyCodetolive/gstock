// Contrat d'API des modules M11 (approvisionnements, fournisseurs) et M12 (dépenses).
// Les montants sont recalculés par le serveur (§7.4).
import type { Id, IsoDate, Money } from './api'
import type { ProductUnitRef, StockState } from './catalog'
import type { CategoryColor } from './referentials'
import type { Installment } from './credits'

/** Ressource /suppliers */
export interface Supplier {
  id: Id
  name: string
  phone: string | null
  address: string | null
  note: string | null
  is_active: boolean
  /** Totaux sur les boutiques visibles. */
  purchased_total: Money
  paid_total: Money
  due_total: Money
}

export interface SupplierPayload {
  name: string
  phone: string | null
  address: string | null
  note: string | null
  is_active: boolean
}

export type PurchasePaymentStatus = 'paid' | 'partial' | 'unpaid'
export type PurchaseStatus = 'received' | 'cancelled'

export interface PurchaseLineInput {
  product_id: Id
  /** Obligatoire pour un produit à variantes. */
  variant_id?: Id | null
  /** Quantité dans l'unité choisie (`unit_id`). */
  quantity: string
  /** Prix d'achat d'une unité choisie (un carton, par exemple). */
  cost: string
  /** Unité de la ligne, parmi `units` du produit ; absente : l'unité de base. */
  unit_id?: Id | null
  /** Produit suivi : date de péremption de l'arrivage (Y-m-d), facultative (§7.11). */
  expiry_date?: string | null
}

/** POST /shops/{shop_id}/purchases/quote : total calculé par le serveur. */
export interface PurchaseQuoteInput {
  items: PurchaseLineInput[]
  discount?: string
}

export interface PurchaseQuote {
  items: { product_id: Id; variant_id: Id | null; unit: ProductUnitRef; quantity: string; base_quantity: string; cost: Money; subtotal: Money }[]
  subtotal: Money
  discount: Money
  total: Money
}

export interface PurchasePayload extends PurchaseQuoteInput {
  supplier_id: Id | null
  occurred_at?: IsoDate
  note?: string | null
  /** Montant payé au fournisseur à l'enregistrement. */
  paid_amount?: string
  payment_method_id?: Id | null
  /** Mettre à jour le prix d'achat des produits avec ceux saisis. */
  update_costs?: boolean
}

export interface PurchasePayment {
  id: Id
  amount: Money
  method: { id: Id; name: string }
  paid_at: IsoDate
  note: string | null
  user: { id: Id; name: string } | null
  status: 'completed' | 'cancelled'
}

/** Ressource /shops/{shop_id}/purchases, référence AP-N. */
export interface Purchase {
  id: Id
  reference: string
  shop: { id: Id; name: string }
  supplier: { id: Id; name: string; phone: string | null } | null
  occurred_at: IsoDate
  /** `unit` : unité d'achat de la ligne ; `base_quantity` : ce qui est entré en stock, en unité de base. */
  items: { product: { id: Id; name: string; unit: ProductUnitRef }; variant: { id: Id; name: string } | null; unit: ProductUnitRef; quantity: string; base_quantity: string; cost: Money; subtotal: Money; expiry_date?: string | null }[]
  subtotal: Money
  discount: Money
  total: Money
  paid_amount: Money
  due_amount: Money
  payment_status: PurchasePaymentStatus
  status: PurchaseStatus
  payments: PurchasePayment[]
  /** Échéancier facultatif du reste dû (§7.7) ; vide s'il n'y en a pas. */
  installments: Installment[]
  note: string | null
  user: { id: Id; name: string } | null
  cancelled_at: IsoDate | null
  cancel_reason: string | null
}

export type PurchaseListItem = Pick<
  Purchase,
  'id' | 'reference' | 'supplier' | 'occurred_at' | 'total' | 'paid_amount' | 'due_amount' | 'payment_status' | 'status'
> & {
  items_count: number
  /** Montant des échéances dépassées et non payées, "0.00" sinon. */
  overdue_amount: Money
}

export interface PurchasesList {
  data: PurchaseListItem[]
  meta: { current_page: number; per_page: number; total: number; last_page: number }
  summary: { count: number; total: Money; paid: Money; due: Money }
}

export type ExpenseStatus = 'completed' | 'cancelled'

/** Ressource /shops/{shop_id}/expenses, référence DP-N. */
export interface Expense {
  id: Id
  reference: string
  occurred_at: IsoDate
  category: { id: Id; name: string }
  amount: Money
  method: { id: Id; name: string }
  note: string | null
  user: { id: Id; name: string } | null
  status: ExpenseStatus
  cancelled_at: IsoDate | null
  cancel_reason: string | null
}

export interface ExpensePayload {
  expense_category_id: Id
  amount: string
  payment_method_id: Id
  occurred_at?: IsoDate
  note?: string | null
  /** Idempotence hors ligne (ADR-005). */
  offline_uuid: string
}

export interface ExpensesList {
  data: Expense[]
  meta: { current_page: number; per_page: number; total: number; last_page: number }
  summary: { count: number; total: Money; by_category: { category: { id: Id; name: string }; total: Money }[] }
}

/** Prix d'achat déduits des approvisionnements reçus (M11). Les prix `*_cost` sont par unité de base. */
export interface PurchasePriceHistory {
  last_purchased_at: string
  last_cost: Money
  /** Prix de la dernière ligne, dans l'unité achetée (`last_unit`, le carton par exemple). */
  last_unit_cost: Money
  last_unit: { id: Id; name: string; short_name: string } | null
  /** null s'il n'y a eu qu'un achat. */
  previous_cost: Money | null
  min_cost: Money
  max_cost: Money
  purchases: number
  /** En unité de base. */
  quantity: string
}

/** GET /suppliers/{id}/products : un produit (ou une variante) acheté chez ce fournisseur. */
export interface SupplierProduct extends PurchasePriceHistory {
  product: {
    id: Id
    name: string
    unit: { id: Id; name: string; short_name: string } | null
    category: { id: Id; name: string; color: CategoryColor } | null
    image_url: string | null
    is_active: boolean
  }
  variant: { id: Id; name: string } | null
  spent: Money
  /** Stock dans la boutique demandée ; null si l'article n'y a jamais eu de stock. */
  stock: { quantity: string; state: StockState } | null
}

/** GET /products/{id}/suppliers : un fournisseur (ou « sans fournisseur ») du produit, le moins cher d'abord. */
export interface ProductSupplier extends PurchasePriceHistory {
  supplier: { id: Id; name: string; phone: string | null; is_active: boolean } | null
  variant: { id: Id; name: string } | null
}
