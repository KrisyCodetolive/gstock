// Endpoints simulés des modules M11 (fournisseurs, approvisionnements) et M12 (dépenses).
import { delay, http, HttpResponse } from 'msw'
import { audit } from '../audit'
import type { Expense, Purchase, PurchaseListItem, Supplier, SupplierPayload } from '@/types/purchases'
import type { MockExpense, MockPurchase, MockSupplier } from '../data/purchases'
import type { MockUser } from '../data/users'
import { db, nextId, persist } from '../db'
import { API, findOr404, handle, normalize, nullable, paginate, requirePermission, Validator } from '../http'
import { addPurchasePayment, cancelExpense, cancelPurchase, computePurchase, purchaseState, recordExpense, recordPurchase } from '../purchases'
import { canSeeAll, money, qty, requireShopAccess, userName } from '../stock'
import { visibleShopIds } from './customers'

const round2 = (n: number) => Math.round(n * 100) / 100

function supplierResource(s: MockSupplier, user: MockUser): Supplier {
  const shops = visibleShopIds(user)
  const purchases = db.purchases.filter((p) => p.supplier_id === s.id && p.status === 'received' && shops.includes(p.shop_id))
  const states = purchases.map(purchaseState)
  return {
    ...s,
    purchased_total: money(purchases.reduce((a, p) => a + p.total, 0))!,
    paid_total: money(states.reduce((a, x) => a + x.paid, 0))!,
    due_total: money(states.reduce((a, x) => a + x.due, 0))!,
  }
}

function purchaseResource(p: MockPurchase): Purchase {
  const supplier = db.suppliers.find((s) => s.id === p.supplier_id)
  const shop = db.shops.find((s) => s.id === p.shop_id)!
  const state = purchaseState(p)
  return {
    id: p.id,
    reference: p.reference,
    shop: { id: shop.id, name: shop.name },
    supplier: supplier ? { id: supplier.id, name: supplier.name, phone: supplier.phone } : null,
    occurred_at: p.occurred_at,
    items: p.items.map((i) => {
      const product = db.products.find((x) => x.id === i.product_id)!
      const unit = db.units.find((u) => u.id === product.unit_id) ?? db.units[0]!
      return {
        product: { id: product.id, name: product.name, unit: { id: unit.id, name: unit.name, short_name: unit.short_name } },
        quantity: qty(i.quantity),
        cost: money(i.cost)!,
        subtotal: money(i.subtotal)!,
      }
    }),
    subtotal: money(p.subtotal)!,
    discount: money(p.discount)!,
    total: money(p.total)!,
    paid_amount: money(state.paid)!,
    due_amount: money(state.due)!,
    payment_status: state.payment_status,
    status: p.status,
    payments: p.payments.map((x) => {
      const m = db.paymentMethods.find((pm) => pm.id === x.payment_method_id)!
      return { id: x.id, amount: money(x.amount)!, method: { id: m.id, name: m.name }, paid_at: x.paid_at, note: x.note, user: userName(x.user_id), status: x.status }
    }),
    note: p.note,
    user: userName(p.user_id),
    cancelled_at: p.cancelled_at,
    cancel_reason: p.cancel_reason,
  }
}

function expenseResource(e: MockExpense): Expense {
  const c = db.expenseCategories.find((x) => x.id === e.expense_category_id)!
  const m = db.paymentMethods.find((x) => x.id === e.payment_method_id)!
  return {
    id: e.id,
    reference: e.reference,
    occurred_at: e.occurred_at,
    category: { id: c.id, name: c.name },
    amount: money(e.amount)!,
    method: { id: m.id, name: m.name },
    note: e.note,
    user: userName(e.user_id),
    status: e.status,
    cancelled_at: e.cancelled_at,
    cancel_reason: e.cancel_reason,
  }
}

/** Sans records.view_all, on ne voit que ses propres opérations (§6.2). */
const visible = (user: MockUser) => (row: { user_id: number }) => canSeeAll(user) || row.user_id === user.id

function inPeriod(iso: string, url: URL) {
  const from = url.searchParams.get('filter[from]')
  const to = url.searchParams.get('filter[to]')
  return (!from || iso >= from) && (!to || iso <= to)
}

function validateSupplier(body: Partial<SupplierPayload>, current?: MockSupplier) {
  const v = new Validator()
  v.required(body.name, 'name', 'Saisissez le nom du fournisseur.')
  if (body.name) v.check(!db.suppliers.some((s) => s.id !== current?.id && normalize(s.name) === normalize(body.name!)), 'name', 'Un autre fournisseur porte déjà ce nom.')
  v.done()
  return { name: body.name!.trim(), phone: nullable(body.phone), address: nullable(body.address), note: nullable(body.note), is_active: body.is_active !== false }
}

export const purchasesHandlers = [
  // ---- Fournisseurs (communs à l'espace) ----
  http.get(`${API}/suppliers`, ({ request }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('suppliers.view', 'purchases.create')
      const rows = [...db.suppliers].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((s) => supplierResource(s, user))
      return paginate(request, rows, {
        searchIn: (s) => `${s.name} ${s.phone ?? ''}`,
        filters: { is_active: (s, v) => String(s.is_active) === v, has_due: (s, v) => (Number(s.due_total) > 0) === (v === 'true') },
      })
    }),
  ),
  http.get(`${API}/suppliers/:id`, ({ params }) =>
    handle(async () => {
      await delay(200)
      const user = requirePermission('suppliers.view')
      return HttpResponse.json({ data: supplierResource(findOr404(db.suppliers, params.id), user) })
    }),
  ),
  http.post(`${API}/suppliers`, ({ request }) =>
    handle(async () => {
      await delay(350)
      const user = requirePermission('suppliers.manage')
      const s: MockSupplier = { id: nextId(db.suppliers), ...validateSupplier((await request.json()) as Partial<SupplierPayload>) }
      db.suppliers.push(s)
      persist()
      return HttpResponse.json({ data: supplierResource(s, user) }, { status: 201 })
    }),
  ),
  http.put(`${API}/suppliers/:id`, ({ request, params }) =>
    handle(async () => {
      await delay(350)
      const user = requirePermission('suppliers.manage')
      const s = findOr404(db.suppliers, params.id)
      Object.assign(s, validateSupplier((await request.json()) as Partial<SupplierPayload>, s))
      persist()
      return HttpResponse.json({ data: supplierResource(s, user) })
    }),
  ),

  // ---- Approvisionnements ----
  http.post(`${API}/shops/:shopId/purchases/quote`, ({ request, params }) =>
    handle(async () => {
      await delay(120)
      const user = requirePermission('purchases.create')
      requireShopAccess(user, params.shopId)
      const c = computePurchase((await request.json()) as never)
      return HttpResponse.json({
        data: {
          items: c.items.map((i) => ({ product_id: i.product_id, quantity: qty(i.quantity), cost: money(i.cost), subtotal: money(i.subtotal) })),
          subtotal: money(c.subtotal),
          discount: money(c.discount),
          total: money(c.total),
        },
      })
    }),
  ),
  http.post(`${API}/shops/:shopId/purchases`, ({ request, params }) =>
    handle(async () => {
      await delay(500)
      const user = requirePermission('purchases.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const p = recordPurchase(shopId, user, (await request.json()) as never)
      persist()
      return HttpResponse.json({ data: purchaseResource(p) }, { status: 201 })
    }),
  ),
  http.get(`${API}/shops/:shopId/purchases`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('purchases.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const url = new URL(request.url)
      const rows: PurchaseListItem[] = db.purchases
        .filter((p) => p.shop_id === shopId && inPeriod(p.occurred_at, url) && visible(user)(p))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .map((p) => {
          const r = purchaseResource(p)
          return { id: r.id, reference: r.reference, supplier: r.supplier, occurred_at: r.occurred_at, total: r.total, paid_amount: r.paid_amount, due_amount: r.due_amount, payment_status: r.payment_status, status: r.status, items_count: r.items.length }
        })
      const filters = {
        supplier_id: (p: PurchaseListItem, v: string) => String(p.supplier?.id ?? '') === v,
        payment_status: (p: PurchaseListItem, v: string) => p.status === 'received' && p.payment_status === v,
      }
      const page = (await paginate(request, rows, { searchIn: (p) => `${p.reference} ${p.supplier?.name ?? ''}`, filters }).json()) as object
      const counted = rows.filter((p) => p.status === 'received' && Object.entries(filters).every(([k, test]) => !url.searchParams.get(`filter[${k}]`) || test(p, url.searchParams.get(`filter[${k}]`)!)))
      return HttpResponse.json({
        ...page,
        summary: {
          count: counted.length,
          total: money(round2(counted.reduce((a, p) => a + Number(p.total), 0))),
          paid: money(round2(counted.reduce((a, p) => a + Number(p.paid_amount), 0))),
          due: money(round2(counted.reduce((a, p) => a + Number(p.due_amount), 0))),
        },
      })
    }),
  ),
  http.get(`${API}/shops/:shopId/purchases/:id`, ({ params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('purchases.view')
      const shopId = requireShopAccess(user, params.shopId).id
      return HttpResponse.json({ data: purchaseResource(findOr404(db.purchases.filter((p) => p.shop_id === shopId && visible(user)(p)), params.id)) })
    }),
  ),
  http.post(`${API}/shops/:shopId/purchases/:id/payments`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('purchase_payments.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const p = findOr404(db.purchases.filter((x) => x.shop_id === shopId), params.id)
      addPurchasePayment(p, user, (await request.json()) as never)
      persist()
      return HttpResponse.json({ data: purchaseResource(p) })
    }),
  ),
  http.post(`${API}/shops/:shopId/purchases/:id/cancel`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('purchases.cancel')
      const shopId = requireShopAccess(user, params.shopId).id
      const p = findOr404(db.purchases.filter((x) => x.shop_id === shopId), params.id)
      const { reason } = (await request.json()) as { reason?: string }
      const v = new Validator()
      v.required(reason, 'reason', 'Indiquez pourquoi vous annulez cet approvisionnement.')
      v.done()
      cancelPurchase(p, user, reason!.trim())
      audit(user, 'purchase.cancelled', { shopId, subject: { type: 'purchase', id: p.id, label: p.reference }, reason: reason!.trim(), old: { total: p.total } })
      persist()
      return HttpResponse.json({ data: purchaseResource(p) })
    }),
  ),

  // ---- Dépenses ----
  http.get(`${API}/shops/:shopId/expenses`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('expenses.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const url = new URL(request.url)
      const category = url.searchParams.get('filter[expense_category_id]')
      const rows = db.expenses
        .filter((e) => e.shop_id === shopId && inPeriod(e.occurred_at, url) && visible(user)(e) && (!category || String(e.expense_category_id) === category))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .map(expenseResource)
      const page = (await paginate(request, rows, { searchIn: (e) => `${e.reference} ${e.category.name} ${e.note ?? ''}` }).json()) as object
      const counted = rows.filter((e) => e.status === 'completed')
      const byCategory = new Map<number, { category: { id: number; name: string }; total: number }>()
      for (const e of counted) {
        const entry = byCategory.get(e.category.id) ?? { category: e.category, total: 0 }
        entry.total += Number(e.amount)
        byCategory.set(e.category.id, entry)
      }
      return HttpResponse.json({
        ...page,
        summary: {
          count: counted.length,
          total: money(round2(counted.reduce((a, e) => a + Number(e.amount), 0))),
          by_category: [...byCategory.values()].sort((a, b) => b.total - a.total).map((x) => ({ category: x.category, total: money(x.total) })),
        },
      })
    }),
  ),
  http.post(`${API}/shops/:shopId/expenses`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('expenses.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const body = (await request.json()) as { offline_uuid?: string }
      // Idempotence hors ligne : une dépense n'est jamais enregistrée deux fois (ADR-005).
      const existing = body.offline_uuid && db.expenses.find((e) => e.offline_uuid === body.offline_uuid)
      if (existing) return HttpResponse.json({ data: expenseResource(existing) })
      const e = recordExpense(shopId, user, body as never)
      persist()
      return HttpResponse.json({ data: expenseResource(e) }, { status: 201 })
    }),
  ),
  http.post(`${API}/shops/:shopId/expenses/:id/cancel`, ({ request, params }) =>
    handle(async () => {
      await delay(350)
      const user = requirePermission('expenses.cancel')
      const shopId = requireShopAccess(user, params.shopId).id
      const e = findOr404(db.expenses.filter((x) => x.shop_id === shopId), params.id)
      const { reason } = (await request.json()) as { reason?: string }
      const v = new Validator()
      v.required(reason, 'reason', 'Indiquez pourquoi vous annulez cette dépense.')
      v.done()
      cancelExpense(e, reason!.trim())
      audit(user, 'expense.cancelled', { shopId, subject: { type: 'expense', id: e.id, label: e.reference }, reason: reason!.trim(), old: { montant: e.amount } })
      persist()
      return HttpResponse.json({ data: expenseResource(e) })
    }),
  ),
]
