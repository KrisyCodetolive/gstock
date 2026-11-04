// Contrat d'API des modules M11 (approvisionnements, fournisseurs) et M12 (dépenses).
// Les montants sont recalculés par le serveur (§7.4).
import type { Id, IsoDate, Money } from './api'
import type { ProductUnitRef } from './catalog'

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
  /** Quantité dans l'unité choisie (`unit_id`). */
  quantity: string
  /** Prix d'achat d'une unité choisie (un carton, par exemple). */
  cost: string
  /** Unité de la ligne, parmi `units` du produit ; absente : l'unité de base. */
  unit_id?: Id | null
}

/** POST /shops/{shop_id}/purchases/quote : total calculé par le serveur. */
export interface PurchaseQuoteInput {
  items: PurchaseLineInput[]
  discount?: string
}

export interface PurchaseQuote {
  items: { product_id: Id; unit: ProductUnitRef; quantity: string; base_quantity: string; cost: Money; subtotal: Money }[]
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
  items: { product: { id: Id; name: string; unit: ProductUnitRef }; unit: ProductUnitRef; quantity: string; base_quantity: string; cost: Money; subtotal: Money }[]
  subtotal: Money
  discount: Money
  total: Money
  paid_amount: Money
  due_amount: Money
  payment_status: PurchasePaymentStatus
  status: PurchaseStatus
  payments: PurchasePayment[]
  note: string | null
  user: { id: Id; name: string } | null
  cancelled_at: IsoDate | null
  cancel_reason: string | null
}

export type PurchaseListItem = Pick<
  Purchase,
  'id' | 'reference' | 'supplier' | 'occurred_at' | 'total' | 'paid_amount' | 'due_amount' | 'payment_status' | 'status'
> & { items_count: number }

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
