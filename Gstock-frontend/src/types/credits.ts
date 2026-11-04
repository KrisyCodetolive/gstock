// Contrat d'API du module M09 : crédits clients, remboursements, échéances,
// avoirs (§7.6, §7.7, décision P3). Les soldes sont toujours calculés par le serveur.
import type { Id, IsoDate, Money } from './api'
import type { CreditStatus } from './customers'
import type { PaymentMethodType } from './referentials'

export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface Installment {
  id: Id
  due_date: IsoDate
  amount: Money
  paid_amount: Money
  status: InstallmentStatus
}

export interface CreditAdjustment {
  id: Id
  /** Positif : diminue le reste (geste commercial). Négatif : l'augmente (erreur de saisie). */
  amount: Money
  reason: string
  user: { id: Id; name: string } | null
  created_at: IsoDate
}

/** Une affectation : la part d'un remboursement appliquée à un crédit. */
export interface CreditAllocation {
  repayment: { id: Id; reference: string; received_at: IsoDate; status: RepaymentStatus }
  credit: { id: Id; reference: string }
  amount: Money
}

/** Ressource crédit, détaillée (fiche crédit du client). */
export interface CreditDetail {
  id: Id
  reference: string
  shop: { id: Id; name: string }
  customer: { id: Id; name: string; phone: string | null }
  sale: { id: Id; reference: string; items: { name: string; quantity: string; subtotal: Money }[] } | null
  is_opening_balance: boolean
  note: string | null
  amount: Money
  /** Σ des affectations de remboursements confirmés. */
  repaid_amount: Money
  /** Σ des régularisations. */
  adjusted_amount: Money
  /** Reste = montant − remboursé − régularisé (§7.6). */
  remaining_amount: Money
  status: CreditStatus
  occurred_at: IsoDate
  allocations: CreditAllocation[]
  adjustments: CreditAdjustment[]
  installments: Installment[]
  cancelled_at: IsoDate | null
  cancel_reason: string | null
  /** Décision P3 appliquée à l'annulation, s'il y avait déjà de l'argent reçu. */
  cancel_settlement: { mode: RefundMode; amount: Money } | null
}

export type RepaymentStatus = 'pending' | 'completed' | 'cancelled'

/** Ressource /shops/{shop_id}/repayments, référence RB-N. */
export interface Repayment {
  id: Id
  reference: string
  shop: { id: Id; name: string }
  customer: { id: Id; name: string; phone: string | null }
  received_at: IsoDate
  amount: Money
  /** null : payé avec l'avoir du client (pas de l'argent reçu). */
  method: { id: Id; name: string; type: PaymentMethodType; uses_geniuspay: boolean } | null
  paid_with_credit_note: boolean
  allocations: { credit: { id: Id; reference: string; is_opening_balance: boolean }; amount: Money }[]
  note: string | null
  status: RepaymentStatus
  user: { id: Id; name: string } | null
  /** Solde du client dans la boutique après ce remboursement (reçu). */
  balance_after: Money
  cancelled_at: IsoDate | null
  cancel_reason: string | null
}

export interface RepaymentPayload {
  customer_id: Id
  amount: string
  payment_method_id: Id | null
  /** Payer avec l'avoir du client au lieu d'un mode de paiement. */
  use_credit_note?: boolean
  received_at?: IsoDate
  note?: string | null
  /** Facultatif : sinon le serveur affecte du plus ancien au plus récent (§7.6). */
  allocations?: { credit_id: Id; amount: string }[]
  offline_uuid: string
}

/** Décision P3 : que faire de l'argent déjà reçu sur un crédit annulé. */
export type RefundMode = 'credit_note' | 'refund'

export interface CancelSettlement {
  /** Obligatoire si de l'argent a déjà été reçu sur le crédit. */
  refund_mode?: RefundMode
  /** Pour « rendre l'argent » : comment il est rendu. */
  refund_payment_method_id?: Id
}

/** GET /shops/{shop_id}/credits/summary : les cartes de « Mes crédits clients ». */
export interface CreditsSummary {
  remaining_total: Money
  debtors_count: number
  new_credits: { count: number; amount: Money }
  repayments: { count: number; amount: Money }
  overdue_installments: { count: number; amount: Money }
}

/** GET /shops/{shop_id}/credits/debtors : une ligne par client qui doit de l'argent. */
export interface Debtor {
  customer: { id: Id; name: string; phone: string | null }
  credit_total: Money
  repaid_total: Money
  balance: Money
  open_credits: number
  last_operation_at: IsoDate | null
  credit_note_balance: Money
}

/** Ligne de la liste des crédits (« Nouveaux crédits »). */
export type CreditListItem = Pick<
  CreditDetail,
  'id' | 'reference' | 'customer' | 'sale' | 'is_opening_balance' | 'amount' | 'remaining_amount' | 'status' | 'occurred_at'
>

/** GET /customers/{id}/credits : la fiche crédit d'un client. */
export interface CustomerCreditFile {
  customer: { id: Id; name: string; phone: string | null; district: string | null }
  totals: { credit_total: Money; repaid_total: Money; balance: Money }
  balances: { shop: { id: Id; name: string }; balance: Money }[]
  /** Avoir : somme que la boutique doit au client (décision P3). */
  credit_note_balance: Money
  credits: CreditDetail[]
  repayments: Repayment[]
  refunds: CustomerRefund[]
}

/** Argent rendu au client à l'annulation d'un crédit déjà en partie payé (P3). */
export interface CustomerRefund {
  id: Id
  amount: Money
  method: { id: Id; name: string }
  reason: string
  credit: { id: Id; reference: string }
  created_at: IsoDate
}

export interface InstallmentScheduleItem {
  due_date: string
  amount: string
}

/** Reçu de remboursement prêt à imprimer ou à partager (ADR-013). */
export interface RepaymentReceipt {
  repayment: Repayment
  shop: { name: string; address: string | null; phone: string | null; show_phone: boolean }
  tenant: { name: string; footer: string | null }
}
