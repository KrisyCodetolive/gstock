// Contrat d'API du module M15 : rapports (première partie).
import type { Id, Money } from './api'
import type { CategoryColor } from './referentials'

export interface ReportPeriod {
  /** Y-m-d, au fuseau de l'espace. */
  from: string
  to: string
  days: number
}

export interface SalesDay {
  date: string
  total: Money
  count: number
}

export interface SalesReport {
  period: ReportPeriod
  total: Money
  count: number
  average_ticket: Money
  /** Articles par vente, une décimale. */
  items_per_sale: string
  cost_of_goods: Money
  margin: Money
  /** Faux si un produit vendu n'a pas de prix d'achat : la marge est sous-estimée en coût. */
  margin_complete: boolean
  previous_total: Money
  change_percent: number | null
  /** Chaque jour de la période, les jours sans vente à 0. */
  days: SalesDay[]
  best_day: SalesDay | null
  worst_day: SalesDay | null
}

export interface ReportArticle {
  product: {
    id: Id
    name: string
    unit: { id: Id; name: string; short_name: string } | null
    category: { id: Id; name: string; color: CategoryColor } | null
    image_url: string | null
  }
  variant: { id: Id; name: string } | null
  name: string
}

export interface SoldArticle extends ReportArticle {
  /** En unité de base. */
  quantity: string
  sales: number
  revenue: Money
  /** null si une ligne vendue n'a pas de prix d'achat. */
  cost: Money | null
  margin: Money | null
}

export interface BelowCostArticle extends ReportArticle {
  price: Money
  cost: Money
}

export interface RestockArticle extends ReportArticle {
  /** Fournisseur habituel : le dernier chez qui l'article a été acheté. */
  supplier: { id: Id; name: string } | null
  quantity: string
  sold_last_days: string
  per_day: string
  days_left: number
  suggested_quantity: string
}

export interface DormantArticle extends ReportArticle {
  quantity: string
  value: Money | null
  last_sold_at: string | null
}

export type DormantDays = 30 | 60 | 90

export interface ProductsReport {
  period: ReportPeriod
  sold: SoldArticle[]
  below_cost: BelowCostArticle[]
  restock: { velocity_days: number; horizon_days: number; items: RestockArticle[] }
  dormant: { days: DormantDays; count: number; value: Money; items: DormantArticle[] }
}

export interface ReportQuery {
  from: string
  to: string
}

export interface ReportCustomer {
  id: Id
  name: string
  phone: string | null
}

export type LostDays = 30 | 60 | 90

export interface CustomersReport {
  period: ReportPeriod
  /** Clients de la période, du plus gros montant au plus petit. */
  top: { customer: ReportCustomer; visits: number; revenue: Money; average_basket: Money; margin: Money | null; last_at: string }[]
  known_sales: { count: number; total: Money }
  anonymous_sales: { count: number; total: Money }
  /** Clients dont le premier achat tombe dans la période. */
  new_customers: number
  lost: { days: LostDays; min_visits: number; count: number; items: { customer: ReportCustomer; visits: number; revenue: Money; last_at: string }[] }
  /** À la date du jour. */
  debt_aging: {
    total: Money
    buckets: { key: 'under_30' | '30_60' | 'over_60'; amount: Money; count: number }[]
    top: { customer: ReportCustomer; remaining: Money; oldest_at: string; overdue: Money }[]
  }
  /** `rate` en % ; null si rien n'a été mis à crédit sur la période. */
  recovery: { credited: Money; repaid: Money; rate: number | null }
  payers: {
    late_days: number
    late: { customer: ReportCustomer; remaining: Money; overdue: Money; oldest_at: string }[]
    good: { customer: ReportCustomer; paid: Money; payments: number }[]
  }
}
