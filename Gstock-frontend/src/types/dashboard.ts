// Contrat d'API des modules M13 (tableau de bord) et M14 (journal d'activité).
// Tous les chiffres viennent du serveur, selon la distinction financière du §7.8.
import type { Id, IsoDate, Money } from './api'

export type DashboardPeriod = 'today' | 'week' | 'month'

/** GET /shops/{shop_id}/dashboard?period= (ou /dashboard pour toutes les boutiques). */
export interface Dashboard {
  period: { key: DashboardPeriod; from: IsoDate; to: IsoDate }
  /** Ventes validées, payées ou à crédit. */
  sales: {
    total: Money
    count: number
    /** Part payée au moment de la vente (hors avoir). */
    paid_now: Money
    /** Montants mis à crédit. */
    on_credit: Money
    /** Même durée juste avant (hier pour « aujourd'hui ») : null si rien à comparer. */
    previous_total: Money
    change_percent: number | null
  }
  /** Argent reçu = payé immédiatement + remboursements reçus (hors avoir), par mode. */
  money_in: {
    total: Money
    from_sales: Money
    from_repayments: Money
    by_method: { method: { id: Id; name: string }; amount: Money }[]
  }
  /** Sorties d'argent : dépenses, argent rendu aux clients (P3), paiements aux fournisseurs. */
  money_out: { expenses: Money; customer_refunds: Money; supplier_payments: Money }
  stock: { low: number; out: number }
  credits: { remaining: Money; debtors: number }
  /** Résultat estimé = ventes − coût d'achat des produits vendus − dépenses (§7.8). */
  result: {
    amount: Money
    cost_of_goods: Money
    /** Faux si des produits vendus n'ont pas de prix d'achat : le résultat est incomplet. */
    complete: boolean
  }
  installments: {
    overdue: { count: number; amount: Money }
    upcoming: { count: number; amount: Money }
  }
  recent: ActivityItem[]
}

export type ActivityType = 'sale' | 'sale_credit' | 'repayment' | 'opening_balance' | 'purchase' | 'expense' | 'adjustment'

/** Une ligne d'« activité récente » ; chaque ligne ouvre son détail. */
export interface ActivityItem {
  type: ActivityType
  id: Id
  reference: string
  label: string
  amount: Money | null
  occurred_at: IsoDate
  cancelled: boolean
  user: { id: Id; name: string } | null
  /** Pour une fiche client (crédit, remboursement). */
  customer_id: Id | null
}

/** Ressource /audit-logs (M14). */
export interface AuditLog {
  id: Id
  action: string
  shop: { id: Id; name: string } | null
  user: { id: Id; name: string } | null
  subject: { type: string; id: Id; label: string } | null
  reason: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: IsoDate
}
