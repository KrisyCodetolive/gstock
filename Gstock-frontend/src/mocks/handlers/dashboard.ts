// Endpoints simulés des modules M13 (tableau de bord) et M14 (journal d'activité).
// Les chiffres suivent la distinction financière du §7.8.
import { delay, http, HttpResponse } from 'msw'
import type { ActivityItem, AuditLog, Dashboard, DashboardPeriod } from '@/types/dashboard'
import type { MockUser } from '../data/users'
import { installmentsOf, recomputeCredit } from '../credits'
import { db } from '../db'
import { API, handle, isOwner, MockHttpError, paginate, requirePermission } from '../http'
import { alertOf, canSeeAll, money, requireShopAccess, stockKeys, stockRow, stockState, userName } from '../stock'
import { visibleShopIds } from './customers'

const DAY = 86_400_000
const round2 = (n: number) => Math.round(n * 100) / 100

/** Période au fuseau de l'espace (Africa/Abidjan = UTC, §7.10), et la même durée juste avant. */
function range(period: DashboardPeriod) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const days = period === 'today' ? 1 : period === 'week' ? 7 : 30
  const from = start.getTime() - (days - 1) * DAY
  const to = Date.now()
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), prevFrom: new Date(from - days * DAY).toISOString(), prevTo: new Date(from - 1).toISOString() }
}

function buildDashboard(user: MockUser, shopIds: number[], period: DashboardPeriod): Dashboard {
  const r = range(period)
  const mine = (row: { user_id: number }) => canSeeAll(user) || row.user_id === user.id
  const inShops = (row: { shop_id: number }) => shopIds.includes(row.shop_id)
  const between = (iso: string, from: string, to: string) => iso >= from && iso <= to

  // Ventes validées (payées ou à crédit) de la période.
  const sales = db.sales.filter((s) => inShops(s) && mine(s) && s.status === 'completed' && between(s.occurred_at, r.from, r.to))
  const previous = db.sales.filter((s) => inShops(s) && mine(s) && s.status === 'completed' && between(s.occurred_at, r.prevFrom, r.prevTo))
  const salesTotal = round2(sales.reduce((a, s) => a + s.total, 0))
  const previousTotal = round2(previous.reduce((a, s) => a + s.total, 0))
  // Payé immédiatement : paiements réels, hors avoir (un avoir n'est pas un encaissement).
  const salePayments = sales.flatMap((s) => s.payments.filter((p) => p.status === 'completed' && p.payment_method_id !== null))
  const paidNow = round2(salePayments.reduce((a, p) => a + p.amount, 0))

  // Remboursements reçus : encaissement mais pas vente (§7.8).
  const repayments = db.repayments.filter((x) => inShops(x) && mine(x) && x.status === 'completed' && x.payment_method_id !== null && between(x.received_at, r.from, r.to))
  const fromRepayments = round2(repayments.reduce((a, x) => a + x.amount, 0))

  const byMethod = new Map<number, number>()
  for (const p of salePayments) byMethod.set(p.payment_method_id!, (byMethod.get(p.payment_method_id!) ?? 0) + p.amount)
  for (const x of repayments) byMethod.set(x.payment_method_id!, (byMethod.get(x.payment_method_id!) ?? 0) + x.amount)

  const expenses = db.expenses.filter((e) => inShops(e) && mine(e) && e.status === 'completed' && between(e.occurred_at, r.from, r.to))
  const expensesTotal = round2(expenses.reduce((a, e) => a + e.amount, 0))
  const refunds = db.customerRefunds.filter((x) => inShops(x) && mine(x) && between(x.created_at, r.from, r.to))
  const supplierPayments = db.purchases
    .filter((p) => inShops(p) && mine(p))
    .flatMap((p) => p.payments.filter((x) => x.status === 'completed' && between(x.paid_at, r.from, r.to)))

  // Coût d'achat des produits vendus, pour le résultat estimé.
  const lines = sales.flatMap((s) => s.items)
  const costOfGoods = round2(lines.reduce((a, i) => a + (i.unit_cost ?? 0) * i.quantity, 0))
  const complete = lines.every((i) => i.unit_cost !== null)

  // Stock et crédits : état actuel, pas une période.
  // Un article par produit simple ou par variante active.
  const stockItems = db.products
    .filter((p) => p.is_active && p.type !== 'service')
    .flatMap((p) => stockKeys(p).filter((v) => v === null || p.variants?.find((x) => x.id === v)?.is_active).map((v) => ({ p, v })))
    .flatMap(({ p, v }) => shopIds.map((id) => stockState(stockRow(id, p.id, v).quantity, alertOf(p, id, v))))
  const credits = db.credits.filter((c) => inShops(c) && c.status !== 'cancelled')
  credits.forEach(recomputeCredit)
  const open = credits.filter((c) => c.remaining_amount > 0)
  const week = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10)
  const installments = open.flatMap((c) => installmentsOf(c))
  const overdue = installments.filter((i) => i.status === 'overdue')
  const upcoming = installments.filter((i) => i.status !== 'paid' && i.status !== 'overdue' && i.due_date <= week)

  return {
    period: { key: period, from: r.from, to: r.to },
    sales: {
      total: money(salesTotal)!,
      count: sales.length,
      paid_now: money(paidNow)!,
      on_credit: money(round2(sales.reduce((a, s) => a + s.credit_amount, 0)))!,
      previous_total: money(previousTotal)!,
      change_percent: previousTotal > 0 ? Math.round(((salesTotal - previousTotal) / previousTotal) * 100) : null,
    },
    money_in: {
      total: money(round2(paidNow + fromRepayments))!,
      from_sales: money(paidNow)!,
      from_repayments: money(fromRepayments)!,
      by_method: [...byMethod.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, amount]) => ({ method: { id, name: db.paymentMethods.find((m) => m.id === id)?.name ?? '—' }, amount: money(round2(amount))! })),
    },
    money_out: {
      expenses: money(expensesTotal)!,
      customer_refunds: money(round2(refunds.reduce((a, x) => a + x.amount, 0)))!,
      supplier_payments: money(round2(supplierPayments.reduce((a, x) => a + x.amount, 0)))!,
    },
    stock: { low: stockItems.filter((s) => s === 'low').length, out: stockItems.filter((s) => s === 'out').length },
    credits: { remaining: money(round2(open.reduce((a, c) => a + c.remaining_amount, 0)))!, debtors: new Set(open.map((c) => c.customer_id)).size },
    result: { amount: money(round2(salesTotal - costOfGoods - expensesTotal))!, cost_of_goods: money(costOfGoods)!, complete },
    installments: {
      overdue: { count: overdue.length, amount: money(round2(overdue.reduce((a, i) => a + i.amount - i.paid_amount, 0)))! },
      upcoming: { count: upcoming.length, amount: money(round2(upcoming.reduce((a, i) => a + i.amount - i.paid_amount, 0)))! },
    },
    recent: recentActivity(user, shopIds),
  }
}

/** Dernières opérations de toutes natures ; chaque ligne ouvre son détail. */
function recentActivity(user: MockUser, shopIds: number[]): ActivityItem[] {
  const mine = (row: { user_id: number; shop_id: number }) => shopIds.includes(row.shop_id) && (canSeeAll(user) || row.user_id === user.id)
  const customerName = (id: number | null) => db.customers.find((c) => c.id === id)?.name
  const items: ActivityItem[] = [
    ...db.sales.filter(mine).map((s) => ({
      type: (s.credit_amount > 0 ? 'sale_credit' : 'sale') as ActivityItem['type'],
      id: s.id,
      reference: s.reference,
      label: customerName(s.customer_id) ?? '',
      amount: money(s.total),
      occurred_at: s.occurred_at,
      cancelled: s.status === 'cancelled',
      user: userName(s.user_id),
      customer_id: s.customer_id,
    })),
    ...db.repayments.filter(mine).map((x) => ({
      type: 'repayment' as const,
      id: x.id,
      reference: x.reference,
      label: customerName(x.customer_id) ?? '',
      amount: money(x.amount),
      occurred_at: x.received_at,
      cancelled: x.status === 'cancelled',
      user: userName(x.user_id),
      customer_id: x.customer_id,
    })),
    ...db.credits.filter((c) => c.is_opening_balance && mine(c)).map((c) => ({
      type: 'opening_balance' as const,
      id: c.id,
      reference: c.reference,
      label: customerName(c.customer_id) ?? '',
      amount: money(c.amount),
      occurred_at: c.occurred_at,
      cancelled: c.status === 'cancelled',
      user: userName(c.user_id),
      customer_id: c.customer_id,
    })),
    ...db.purchases.filter(mine).map((p) => ({
      type: 'purchase' as const,
      id: p.id,
      reference: p.reference,
      label: db.suppliers.find((s) => s.id === p.supplier_id)?.name ?? '',
      amount: money(p.total),
      occurred_at: p.occurred_at,
      cancelled: p.status === 'cancelled',
      user: userName(p.user_id),
      customer_id: null,
    })),
    ...db.expenses.filter(mine).map((e) => ({
      type: 'expense' as const,
      id: e.id,
      reference: e.reference,
      label: db.expenseCategories.find((c) => c.id === e.expense_category_id)?.name ?? '',
      amount: money(e.amount),
      occurred_at: e.occurred_at,
      cancelled: e.status === 'cancelled',
      user: userName(e.user_id),
      customer_id: null,
    })),
    ...db.adjustments.filter(mine).map((a) => ({
      type: 'adjustment' as const,
      id: a.id,
      reference: a.reference,
      label: a.reason,
      amount: null,
      occurred_at: a.occurred_at,
      cancelled: a.status === 'cancelled',
      user: userName(a.user_id),
      customer_id: null,
    })),
  ]
  return items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 10)
}

const periodOf = (request: Request): DashboardPeriod => {
  const p = new URL(request.url).searchParams.get('period')
  return p === 'week' || p === 'month' ? p : 'today'
}

function auditResource(a: (typeof db.auditLogs)[number]): AuditLog {
  const shop = db.shops.find((s) => s.id === a.shop_id)
  return {
    id: a.id,
    action: a.action,
    shop: shop ? { id: shop.id, name: shop.name } : null,
    user: userName(a.user_id),
    subject: a.subject,
    reason: a.reason,
    old_values: a.old_values,
    new_values: a.new_values,
    created_at: a.created_at,
  }
}

export const dashboardHandlers = [
  http.get(`${API}/shops/:shopId/dashboard`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('dashboard.view')
      const shopId = requireShopAccess(user, params.shopId).id
      return HttpResponse.json({ data: buildDashboard(user, [shopId], periodOf(request)) })
    }),
  ),

  // « Toutes mes boutiques » : réservé au propriétaire (§3.6).
  http.get(`${API}/dashboard`, ({ request }) =>
    handle(async () => {
      await delay(350)
      const user = requirePermission('dashboard.view')
      if (!isOwner(user)) throw new MockHttpError(403, "Vous n'avez pas accès à cette vue.")
      const shops = db.shops.filter((s) => s.is_active).map((s) => s.id)
      return HttpResponse.json({ data: buildDashboard(user, shops, periodOf(request)) })
    }),
  ),

  http.get(`${API}/audit-logs`, ({ request }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('audit.view')
      const shops = visibleShopIds(user)
      const url = new URL(request.url)
      const from = url.searchParams.get('filter[from]')
      // Les actions sans boutique (rôles, utilisateurs, paramètres) ne sont visibles que du propriétaire.
      const rows = db.auditLogs
        .filter((a) => (a.shop_id === null ? isOwner(user) : shops.includes(a.shop_id)) && (!from || a.created_at >= from))
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
        .map(auditResource)
      return paginate(request, rows, {
        searchIn: (a) => `${a.subject?.label ?? ''} ${a.reason ?? ''} ${a.user?.name ?? ''}`,
        filters: {
          domain: (a, v) => a.action.split('.')[0] === v,
          user_id: (a, v) => String(a.user?.id ?? '') === v,
          shop_id: (a, v) => String(a.shop?.id ?? '') === v,
        },
      })
    }),
  ),
]

