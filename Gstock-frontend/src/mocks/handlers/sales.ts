// Endpoints simulés du module M08 : caisse, ventes, reçus.
import { delay, http, HttpResponse } from 'msw'
import { audit } from '../audit'
import type { PosBootstrap, Receipt, Sale, SaleListItem, SalePayload, SaleQuoteInput, ShareLink } from '@/types/sales'
import type { MockUser } from '../data/users'
import { db, persist } from '../db'
import { API, findOr404, handle, paginate, requirePermission, Validator } from '../http'
import { recomputeCredit, repaidOf, type Settlement } from '../credits'
import { cancelSale, computeSale, quoteResource, recordSale, type MockSale } from '../sales'
import { signReceiptToken } from '../receipt-token'
import { alertOf, canSeeAll, money, qty, requireShopAccess, stockRow, stockState, userName } from '../stock'

function saleResource(s: MockSale): Sale {
  const shop = db.shops.find((x) => x.id === s.shop_id)!
  const customer = db.customers.find((c) => c.id === s.customer_id)
  const credit = db.credits.find((c) => c.sale_id === s.id)
  if (credit) recomputeCredit(credit)
  return {
    id: s.id,
    reference: s.reference,
    shop: { id: shop.id, name: shop.name },
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    user: userName(s.user_id),
    occurred_at: s.occurred_at,
    items: s.items.map((i) => {
      const p = db.products.find((x) => x.id === i.product_id)!
      const unit = db.units.find((u) => u.id === p.unit_id) ?? db.units[0]!
      return {
        product: { id: p.id, name: p.name, type: p.type, unit: { id: unit.id, name: unit.name, short_name: unit.short_name } },
        quantity: qty(i.quantity),
        price: money(i.price)!,
        discount: money(i.discount)!,
        discount_method: i.discount_method,
        discount_amount: money(i.discount_amount)!,
        subtotal: money(i.subtotal)!,
      }
    }),
    subtotal: money(s.subtotal)!,
    discount: money(s.discount)!,
    tax_amount: money(s.tax_amount)!,
    total: money(s.total)!,
    paid_now: money(s.paid_now)!,
    credit_amount: money(s.credit_amount)!,
    payment_status: s.payment_status,
    status: s.status,
    payments: s.payments.map((p) => {
      const m = db.paymentMethods.find((x) => x.id === p.payment_method_id)
      return {
        id: p.id,
        method: m ? { id: m.id, name: m.name, type: m.type, uses_geniuspay: m.uses_geniuspay } : null,
        amount: money(p.amount)!,
        cash_given: money(p.cash_given),
        change: money(p.change),
        status: p.status,
      }
    }),
    credit: credit
      ? { id: credit.id, remaining_amount: money(credit.remaining_amount)!, repaid_amount: money(repaidOf(credit))!, status: credit.status }
      : null,
    note: s.note,
    cancelled_at: s.cancelled_at,
    cancel_reason: s.cancel_reason,
  }
}

/** Ventes visibles : la boutique, et ses propres ventes sans records.view_all (§6.2). */
function visibleSales(user: MockUser, shopId: number) {
  return db.sales.filter((s) => s.shop_id === shopId && (canSeeAll(user) || s.user_id === user.id))
}

/** Webhook GeniusPay simulé : confirme les paiements en attente après quelques secondes. */
function simulateWebhook(sale: MockSale) {
  if (!sale.payments.some((p) => p.status === 'pending')) return
  setTimeout(() => {
    for (const p of sale.payments) if (p.status === 'pending') p.status = 'completed'
    persist()
  }, 4000)
}

export function receiptResource(sale: MockSale): Receipt {
  const shop = db.shops.find((s) => s.id === sale.shop_id)!
  return {
    sale: saleResource(sale),
    shop: {
      name: shop.name,
      address: [shop.address, shop.district, shop.city].filter(Boolean).join(', ') || null,
      phone: shop.phone,
      note: shop.receipt_note,
      show_customer: shop.receipt_show_customer,
      show_phone: shop.receipt_show_phone,
    },
    tenant: { name: db.settings.name, footer: db.settings.receipt_footer },
  }
}

export const salesHandlers = [
  // Tout ce qu'il faut à la caisse, aussi pour le cache hors ligne (M08).
  http.get(`${API}/shops/:shopId/pos/bootstrap`, ({ params }) =>
    handle(async () => {
      await delay(350)
      const user = requirePermission('sales.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const unitOf = (id: number) => db.units.find((u) => u.id === id) ?? db.units[0]!
      const data: PosBootstrap = {
        products: db.products
          .filter((p) => p.is_active)
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
          .map((p) => {
            const category = db.categories.find((c) => c.id === p.category_id)
            const unit = unitOf(p.unit_id)
            const q = p.type === 'service' ? null : stockRow(shopId, p.id).quantity
            return {
              id: p.id,
              type: p.type,
              name: p.name,
              code: p.code,
              barcode: p.barcode,
              price: money(p.price)!,
              unit: { id: unit.id, name: unit.name, short_name: unit.short_name },
              category: category ? { id: category.id, name: category.name, color: category.color } : null,
              quantity: q === null ? null : qty(q),
              state: q === null ? null : stockState(q, alertOf(p, shopId)),
            }
          }),
        categories: db.categories.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, color: c.color })),
        payment_methods: db.paymentMethods
          .filter((m) => m.is_active)
          .map((m) => ({ id: m.id, name: m.name, type: m.type, uses_geniuspay: m.uses_geniuspay && db.paymentSettings.is_active })),
        geniuspay_enabled: db.paymentSettings.is_active,
      }
      return HttpResponse.json({ data })
    }),
  ),

  // Calcul des montants sans rien enregistrer : la caisse affiche ce que dit le serveur (§7.4).
  http.post(`${API}/shops/:shopId/sales/quote`, ({ request, params }) =>
    handle(async () => {
      await delay(120)
      const user = requirePermission('sales.create')
      requireShopAccess(user, params.shopId)
      const body = (await request.json()) as SaleQuoteInput
      return HttpResponse.json({ data: quoteResource(computeSale(body, user)) })
    }),
  ),

  http.post(`${API}/shops/:shopId/sales`, ({ request, params }) =>
    handle(async () => {
      await delay(500)
      const user = requirePermission('sales.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const body = (await request.json()) as SalePayload
      // Idempotence : un second envoi renvoie la vente déjà enregistrée (ADR-005).
      const existing = body.offline_uuid && db.sales.find((s) => s.offline_uuid === body.offline_uuid)
      if (existing) return HttpResponse.json({ data: saleResource(existing) })
      const sale = recordSale(shopId, user, body)
      // Prix modifié à la caisse : action sensible (M14).
      const changed = sale.items.filter((i) => i.price !== db.products.find((p) => p.id === i.product_id)!.price)
      if (changed.length) {
        audit(user, 'sale.price_changed', {
          shopId,
          subject: { type: 'sale', id: sale.id, label: sale.reference },
          old: { prix: changed.map((i) => ({ produit: db.products.find((p) => p.id === i.product_id)!.name, prix: db.products.find((p) => p.id === i.product_id)!.price })) },
          new: { prix: changed.map((i) => ({ produit: db.products.find((p) => p.id === i.product_id)!.name, prix: i.price })) },
        })
      }
      persist()
      simulateWebhook(sale)
      return HttpResponse.json({ data: saleResource(sale) }, { status: 201 })
    }),
  ),

  http.get(`${API}/shops/:shopId/sales`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('sales.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const url = new URL(request.url)
      const from = url.searchParams.get('filter[from]')
      const to = url.searchParams.get('filter[to]')
      const rows: (SaleListItem & { user_id: number })[] = visibleSales(user, shopId)
        .filter((s) => (!from || s.occurred_at >= from) && (!to || s.occurred_at <= to))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .map((s) => {
          const r = saleResource(s)
          return {
            id: r.id,
            reference: r.reference,
            customer: r.customer,
            user: r.user,
            user_id: s.user_id,
            occurred_at: r.occurred_at,
            total: r.total,
            paid_now: r.paid_now,
            credit_amount: r.credit_amount,
            payment_status: r.payment_status,
            status: r.status,
            items_count: r.items.length,
          }
        })
      const filters = {
        payment_status: (s: SaleListItem, v: string) => s.payment_status === v,
        status: (s: SaleListItem, v: string) => s.status === v,
        customer_id: (s: SaleListItem, v: string) => String(s.customer?.id ?? '') === v,
        user_id: (s: (typeof rows)[number], v: string) => String(s.user_id) === v,
      }
      const page = (await paginate(request, rows, { searchIn: (s) => `${s.reference} ${s.customer?.name ?? ''}`, filters }).json()) as {
        data: (typeof rows)[number][]
      }
      // Totaux de toute la liste filtrée, hors ventes annulées.
      const filtered = rows.filter((s) =>
        Object.entries(filters).every(([k, test]) => {
          const v = url.searchParams.get(`filter[${k}]`)
          return !v || test(s, v)
        }),
      ).filter((s) => !url.searchParams.get('search') || `${s.reference} ${s.customer?.name ?? ''}`.toLowerCase().includes(url.searchParams.get('search')!.toLowerCase()))
      const counted = filtered.filter((s) => s.status === 'completed')
      return HttpResponse.json({
        ...page,
        data: page.data.map(({ user_id: _u, ...s }) => s),
        summary: {
          count: counted.length,
          total: money(counted.reduce((a, s) => a + Number(s.total), 0)),
          paid_now: money(counted.reduce((a, s) => a + Number(s.paid_now), 0)),
          credit_amount: money(counted.reduce((a, s) => a + Number(s.credit_amount), 0)),
        },
      })
    }),
  ),

  http.get(`${API}/shops/:shopId/sales/:id`, ({ params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('sales.view', 'sales.create')
      const shopId = requireShopAccess(user, params.shopId).id
      return HttpResponse.json({ data: saleResource(findOr404(visibleSales(user, shopId), params.id)) })
    }),
  ),

  http.post(`${API}/shops/:shopId/sales/:id/cancel`, ({ request, params }) =>
    handle(async () => {
      await delay(450)
      const user = requirePermission('sales.cancel')
      const shopId = requireShopAccess(user, params.shopId).id
      const sale = findOr404(db.sales.filter((s) => s.shop_id === shopId), params.id)
      const { reason, ...settlement } = (await request.json()) as { reason?: string } & Settlement
      const v = new Validator()
      v.required(reason, 'reason', 'Indiquez pourquoi vous annulez cette vente.')
      v.done()
      cancelSale(sale, user, reason!.trim(), settlement)
      audit(user, 'sale.cancelled', {
        shopId,
        subject: { type: 'sale', id: sale.id, label: sale.reference },
        reason: reason!.trim(),
        old: { statut: 'Validée', total: sale.total },
        new: { statut: 'Annulée', ...(settlement.refund_mode ? { argent_deja_recu: settlement.refund_mode === 'credit_note' ? 'Gardé en avoir' : 'Rendu au client' } : {}) },
      })
      persist()
      return HttpResponse.json({ data: saleResource(sale) })
    }),
  ),

  http.get(`${API}/shops/:shopId/sales/:id/receipt`, ({ params }) =>
    handle(async () => {
      await delay(200)
      const user = requirePermission('sales.view', 'sales.create')
      const shopId = requireShopAccess(user, params.shopId).id
      return HttpResponse.json({ data: receiptResource(findOr404(visibleSales(user, shopId), params.id)) })
    }),
  ),

  http.post(`${API}/shops/:shopId/sales/:id/share-link`, ({ request, params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('sales.view', 'sales.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const sale = findOr404(visibleSales(user, shopId), params.id)
      const { token, exp } = signReceiptToken('s', shopId, sale.id)
      const url = `${new URL(request.url).origin}/recu/${token}`
      const data: ShareLink = {
        url,
        expires_at: new Date(exp).toISOString(),
        message: `Bonjour, voici votre reçu ${sale.reference} de ${db.settings.name} (${money(sale.total)?.replace('.00', '')} FCFA) : ${url}`,
      }
      return HttpResponse.json({ data })
    }),
  ),

]
