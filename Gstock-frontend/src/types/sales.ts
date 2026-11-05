// Contrat d'API du module M08 : caisse et ventes. Tous les montants sont
// recalculés par le serveur ; ceux du navigateur sont ignorés (§7.4).
import type { Id, IsoDate, Money } from './api'
import type { ExpirySummary, ProductCategoryRef, ProductType, ProductUnitRef, StockState } from './catalog'
import type { RepaymentReceipt } from './credits'
import type { PaymentMethodType } from './referentials'

export type DiscountMethod = 'percent' | 'fixed'
export type PaymentStatus = 'paid' | 'partial' | 'credit'
export type SaleStatus = 'completed' | 'cancelled'
export type SalePaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

/** Ligne du panier envoyée au serveur. */
export interface SaleLineInput {
  product_id: Id
  /** Obligatoire pour un produit à variantes. */
  variant_id?: Id | null
  quantity: string
  /** Prix modifié (permission sales.edit_price), sinon le prix du produit. */
  price?: string
  discount?: string
  discount_method?: DiscountMethod
}

export interface SalePaymentInput {
  /** null avec `credit_note` : payé avec l'avoir du client (décision P3). */
  payment_method_id: Id | null
  credit_note?: boolean
  amount: string
  /** Espèces seulement : somme donnée par le client, pour le rendu. */
  cash_given?: string
}

/** POST /shops/{shop_id}/sales/quote : calcul des montants sans rien enregistrer. */
export interface SaleQuoteInput {
  items: SaleLineInput[]
  discount?: string
  payments?: SalePaymentInput[]
}

export interface SaleQuote {
  items: {
    product_id: Id
    variant_id: Id | null
    quantity: string
    price: Money
    discount_amount: Money
    subtotal: Money
  }[]
  subtotal: Money
  discount: Money
  tax_amount: Money
  total: Money
  paid_now: Money
  credit_amount: Money
  /** Rendu monnaie, sur les espèces uniquement ; jamais compté comme argent reçu. */
  change: Money
  payment_status: PaymentStatus
}

export interface SalePayload extends SaleQuoteInput {
  customer_id?: Id | null
  note?: string | null
  /** Idempotence hors ligne (ADR-005). */
  offline_uuid: string
}

export interface SaleItem {
  /** `name` : nom affiché de l'article, avec la variante (« Jus 1 L — Bissap »). */
  product: { id: Id; name: string; type: ProductType; unit: ProductUnitRef }
  variant: { id: Id; name: string } | null
  quantity: string
  price: Money
  discount: Money
  discount_method: DiscountMethod | null
  discount_amount: Money
  subtotal: Money
}

export interface SalePayment {
  id: Id
  /** null : payé avec l'avoir du client. */
  method: { id: Id; name: string; type: PaymentMethodType; uses_geniuspay: boolean } | null
  amount: Money
  cash_given: Money | null
  change: Money | null
  /** Un paiement GeniusPay reste « pending » jusqu'au webhook (ADR-003). */
  status: SalePaymentStatus
}

/** Ressource /shops/{shop_id}/sales, référence V-N. */
export interface Sale {
  id: Id
  reference: string
  shop: { id: Id; name: string }
  customer: { id: Id; name: string; phone: string | null } | null
  user: { id: Id; name: string } | null
  occurred_at: IsoDate
  items: SaleItem[]
  subtotal: Money
  discount: Money
  tax_amount: Money
  total: Money
  paid_now: Money
  credit_amount: Money
  payment_status: PaymentStatus
  status: SaleStatus
  payments: SalePayment[]
  /** `repaid_amount` : déjà payé sur ce crédit ; s'il est > 0, l'annulation demande le choix P3. */
  credit: { id: Id; remaining_amount: Money; repaid_amount: Money; status: string } | null
  note: string | null
  cancelled_at: IsoDate | null
  cancel_reason: string | null
  /** Vente faite hors ligne et synchronisée avec un écart : à vérifier (ADR-005, P2). */
  sync_status: SyncStatus
  /** Écarts constatés à la synchronisation (stock, prix), en français. */
  review_reasons: string[]
}

export type SyncStatus = 'ok' | 'to_review'

/** Ligne de l'historique des ventes. */
export type SaleListItem = Pick<
  Sale,
  'id' | 'reference' | 'customer' | 'user' | 'occurred_at' | 'total' | 'paid_now' | 'credit_amount' | 'payment_status' | 'status' | 'sync_status'
> & { items_count: number }

/** Totaux de la liste filtrée (pas seulement de la page). */
export interface SalesSummary {
  count: number
  total: Money
  paid_now: Money
  credit_amount: Money
}

export interface SalesList {
  data: SaleListItem[]
  meta: { current_page: number; per_page: number; total: number; last_page: number }
  summary: SalesSummary
}

/** GET /shops/{shop_id}/pos/bootstrap : tout ce qu'il faut à la caisse (et au cache hors ligne). */
export interface PosBootstrap {
  /** Une entrée par article vendable : un produit, ou une variante (`variant_id`). */
  products: {
    id: Id
    variant_id: Id | null
    variant_name: string | null
    type: ProductType
    name: string
    code: string
    barcode: string | null
    price: Money
    /** Taxe en %, pour le calcul provisoire hors ligne (mode avancé). */
    tax_rate: string | null
    unit: ProductUnitRef
    category: ProductCategoryRef | null
    image_url: string | null
    quantity: string | null
    state: StockState | null
    /** Alerte de péremption à la caisse, même hors ligne (§7.11). */
    expiry?: ExpirySummary | null
  }[]
  categories: ProductCategoryRef[]
  payment_methods: { id: Id; name: string; type: PaymentMethodType; uses_geniuspay: boolean }[]
  /** GeniusPay actif et configuré pour l'espace. */
  geniuspay_enabled: boolean
  /** Clients actifs et leurs soldes dans la boutique, pour vendre à crédit hors ligne (ADR-005). */
  customers: { id: Id; name: string; phone: string | null; balance: Money; credit_note: Money }[]
  generated_at: IsoDate
}

/** Reçu prêt à imprimer ou à partager (ADR-013). */
export interface Receipt {
  sale: Sale
  shop: { name: string; address: string | null; phone: string | null; note: string | null; show_customer: boolean; show_phone: boolean }
  tenant: { name: string; footer: string | null }
}

export interface ShareLink {
  url: string
  expires_at: IsoDate
  /** Message pré-rempli pour WhatsApp. */
  message: string
}

/** GET /public/receipts/{token} : reçu d'une vente ou d'un remboursement. */
export type PublicReceipt = ({ kind: 'sale' } & Receipt) | ({ kind: 'repayment' } & RepaymentReceipt)
