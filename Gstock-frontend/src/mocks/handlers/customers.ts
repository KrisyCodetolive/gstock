// Endpoints simulés du module M10 : clients (communs à l'espace).
import { delay, http, HttpResponse } from 'msw'
import type { Customer, CustomerCredit, CustomerPayload, CustomerSummary } from '@/types/customers'
import type { MockCustomer } from '../data/customers'
import type { MockUser } from '../data/users'
import { db, nextId, persist } from '../db'
import { API, findOr404, handle, isOwner, nullable, paginate, requirePermission, Validator } from '../http'
import { customerBalance } from '../sales'
import { money } from '../stock'

/** Boutiques dont l'utilisateur peut voir les opérations (§6.2). */
export function visibleShopIds(user: MockUser): number[] {
  return db.shops.filter((s) => isOwner(user) || user.shop_ids.includes(s.id)).map((s) => s.id)
}

export function customerResource(c: MockCustomer, user: MockUser): Customer {
  return { ...c, balance: money(customerBalance(c.id, visibleShopIds(user)))! }
}

export function creditResource(credit: (typeof db.credits)[number]): CustomerCredit {
  const shop = db.shops.find((s) => s.id === credit.shop_id)!
  const sale = db.sales.find((s) => s.id === credit.sale_id)
  return {
    id: credit.id,
    reference: credit.reference,
    shop: { id: shop.id, name: shop.name },
    sale: sale ? { id: sale.id, reference: sale.reference } : null,
    is_opening_balance: credit.is_opening_balance,
    amount: money(credit.amount)!,
    remaining_amount: money(credit.remaining_amount)!,
    status: credit.status,
    occurred_at: credit.occurred_at,
  }
}

const normalizePhone = (value: string) => value.replace(/[\s.-]/g, '').replace(/^\+225/, '')

function validate(body: Partial<CustomerPayload>, current?: MockCustomer) {
  const v = new Validator()
  v.required(body.name, 'name', 'Saisissez le nom du client.')
  const phone = nullable(body.phone) ? normalizePhone(body.phone!) : null
  if (phone) {
    v.check(/^\d{8,12}$/.test(phone), 'phone', "Ce numéro de téléphone n'est pas valide.")
    v.check(!db.customers.some((c) => c.id !== current?.id && c.phone === phone), 'phone', 'Un autre client a déjà ce numéro.')
  }
  v.done()
  return {
    name: body.name!.trim(),
    phone,
    district: nullable(body.district),
    note: nullable(body.note),
    is_active: body.is_active !== false,
  }
}

export const customersHandlers = [
  http.get(`${API}/customers`, ({ request }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('customers.view', 'sales.create')
      const rows = [...db.customers].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((c) => customerResource(c, user))
      return paginate(request, rows, {
        searchIn: (c) => `${c.name} ${c.phone ?? ''} ${c.district ?? ''}`,
        filters: {
          is_active: (c, v) => String(c.is_active) === v,
          // « Doit de l'argent » : solde > 0.
          has_balance: (c, v) => (Number(c.balance) > 0) === (v === 'true'),
        },
      })
    }),
  ),

  http.get(`${API}/customers/:id`, ({ params }) =>
    handle(async () => {
      await delay(200)
      const user = requirePermission('customers.view', 'sales.create')
      return HttpResponse.json({ data: customerResource(findOr404(db.customers, params.id), user) })
    }),
  ),

  http.get(`${API}/customers/:id/summary`, ({ params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('customers.view')
      const customer = findOr404(db.customers, params.id)
      const shopIds = visibleShopIds(user)
      const sales = db.sales
        .filter((s) => s.customer_id === customer.id && shopIds.includes(s.shop_id))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      const completed = sales.filter((s) => s.status === 'completed')
      const summary: CustomerSummary = {
        customer: customerResource(customer, user),
        balances: shopIds.map((id) => {
          const shop = db.shops.find((s) => s.id === id)!
          return { shop: { id, name: shop.name }, balance: money(customerBalance(customer.id, [id]))! }
        }),
        purchases: {
          count: completed.length,
          total: money(completed.reduce((s, x) => s + x.total, 0))!,
          last_at: completed[0]?.occurred_at ?? null,
        },
        recent_sales: sales.slice(0, 10).map((s) => ({
          id: s.id,
          reference: s.reference,
          shop: { id: s.shop_id, name: db.shops.find((x) => x.id === s.shop_id)!.name },
          total: money(s.total)!,
          payment_status: s.payment_status,
          status: s.status,
          occurred_at: s.occurred_at,
        })),
        credits: db.credits
          .filter((c) => c.customer_id === customer.id && shopIds.includes(c.shop_id))
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
          .map(creditResource),
      }
      return HttpResponse.json({ data: summary })
    }),
  ),

  // Création rapide possible depuis la caisse : nom seul obligatoire (M10).
  http.post(`${API}/customers`, ({ request }) =>
    handle(async () => {
      await delay(350)
      const user = requirePermission('customers.create')
      const fields = validate((await request.json()) as Partial<CustomerPayload>)
      const customer: MockCustomer = { id: nextId(db.customers), ...fields, created_at: new Date().toISOString() }
      db.customers.push(customer)
      persist()
      return HttpResponse.json({ data: customerResource(customer, user) }, { status: 201 })
    }),
  ),

  http.put(`${API}/customers/:id`, ({ request, params }) =>
    handle(async () => {
      await delay(350)
      const user = requirePermission('customers.update')
      const customer = findOr404(db.customers, params.id)
      Object.assign(customer, validate((await request.json()) as Partial<CustomerPayload>, customer))
      persist()
      return HttpResponse.json({ data: customerResource(customer, user) })
    }),
  ),
]

