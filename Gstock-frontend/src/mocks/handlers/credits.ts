// Endpoints simulés du module M09 : crédits clients, remboursements, échéances,
// avoirs (décision P3), et reçus publics (ventes et remboursements).
import { delay, http, HttpResponse } from 'msw'
import { audit } from '../audit'
import type { CreditDetail, CreditListItem, CustomerCreditFile, CustomerRefund, Debtor, Repayment, RepaymentReceipt } from '@/types/credits'
import type { MockCredit, MockRepayment } from '../data/customers'
import type { MockUser } from '../data/users'
import {
  adjustCredit,
  allocationsOf,
  adjustedOf,
  cancelCredit,
  cancelRepayment,
  creditNoteBalance,
  installmentsOf,
  recomputeCredit,
  recomputeCustomer,
  recordRepayment,
  repaidOf,
  setInstallments,
  type RepaymentInput,
  type Settlement,
} from '../credits'
import { db, nextReference, persist } from '../db'
import { API, findOr404, handle, MockHttpError, paginate, requirePermission, Validator } from '../http'
import { readReceiptToken, signReceiptToken } from '../receipt-token'
import { customerBalance } from '../sales'
import { canSeeAll, money, qty, requireShopAccess, userName } from '../stock'
import { receiptResource } from './sales'
import { visibleShopIds } from './customers'

const shopRef = (id: number) => {
  const s = db.shops.find((x) => x.id === id)!
  return { id: s.id, name: s.name }
}
const customerRef = (id: number) => {
  const c = db.customers.find((x) => x.id === id)!
  return { id: c.id, name: c.name, phone: c.phone }
}

function creditDetail(c: MockCredit): CreditDetail {
  recomputeCredit(c)
  const sale = db.sales.find((s) => s.id === c.sale_id)
  return {
    id: c.id,
    reference: c.reference,
    shop: shopRef(c.shop_id),
    customer: customerRef(c.customer_id),
    sale: sale
      ? {
          id: sale.id,
          reference: sale.reference,
          items: sale.items.map((i) => ({ name: db.products.find((p) => p.id === i.product_id)!.name, quantity: qty(i.quantity), subtotal: money(i.subtotal)! })),
        }
      : null,
    is_opening_balance: c.is_opening_balance,
    note: c.note ?? null,
    amount: money(c.amount)!,
    repaid_amount: money(repaidOf(c))!,
    adjusted_amount: money(adjustedOf(c))!,
    remaining_amount: money(c.remaining_amount)!,
    status: c.status,
    occurred_at: c.occurred_at,
    allocations: allocationsOf(c.id).map((a) => ({
      repayment: { id: a.repayment.id, reference: a.repayment.reference, received_at: a.repayment.received_at, status: a.repayment.status },
      credit: { id: c.id, reference: c.reference },
      amount: money(a.amount)!,
    })),
    adjustments: db.creditAdjustments
      .filter((a) => a.credit_id === c.id)
      .map((a) => ({ id: a.id, amount: money(a.amount)!, reason: a.reason, user: userName(a.user_id), created_at: a.created_at })),
    installments: installmentsOf(c).map((i) => ({ ...i, amount: money(i.amount)!, paid_amount: money(i.paid_amount)! })),
    cancelled_at: c.cancelled_at ?? null,
    cancel_reason: c.cancel_reason ?? null,
    cancel_settlement: c.cancel_settlement ? { mode: c.cancel_settlement.mode, amount: money(c.cancel_settlement.amount)! } : null,
  }
}

function repaymentResource(r: MockRepayment): Repayment {
  const m = db.paymentMethods.find((x) => x.id === r.payment_method_id)
  // Solde du client dans la boutique après ce remboursement (pour le reçu).
  const balanceAfter = customerBalance(r.customer_id, [r.shop_id])
  return {
    id: r.id,
    reference: r.reference,
    shop: shopRef(r.shop_id),
    customer: customerRef(r.customer_id),
    received_at: r.received_at,
    amount: money(r.amount)!,
    method: m ? { id: m.id, name: m.name, type: m.type, uses_geniuspay: m.uses_geniuspay } : null,
    paid_with_credit_note: r.payment_method_id === null,
    allocations: r.allocations.map((a) => {
      const c = db.credits.find((x) => x.id === a.credit_id)!
      return { credit: { id: c.id, reference: c.reference, is_opening_balance: c.is_opening_balance }, amount: money(a.amount)! }
    }),
    note: r.note,
    status: r.status,
    user: userName(r.user_id),
    balance_after: money(balanceAfter)!,
    cancelled_at: r.cancelled_at,
    cancel_reason: r.cancel_reason,
  }
}

function refundResource(r: (typeof db.customerRefunds)[number]): CustomerRefund {
  const m = db.paymentMethods.find((x) => x.id === r.payment_method_id)!
  const c = db.credits.find((x) => x.id === r.credit_id)!
  return { id: r.id, amount: money(r.amount)!, method: { id: m.id, name: m.name }, reason: r.reason, credit: { id: c.id, reference: c.reference }, created_at: r.created_at }
}

function repaymentReceipt(r: MockRepayment): RepaymentReceipt {
  const shop = db.shops.find((s) => s.id === r.shop_id)!
  return {
    repayment: repaymentResource(r),
    shop: {
      name: shop.name,
      address: [shop.address, shop.district, shop.city].filter(Boolean).join(', ') || null,
      phone: shop.phone,
      show_phone: shop.receipt_show_phone,
    },
    tenant: { name: db.settings.name, footer: db.settings.receipt_footer },
  }
}

/** Sans records.view_all, on ne voit que ses propres opérations (§6.2). */
const visible = (user: MockUser) => (row: { user_id: number }) => canSeeAll(user) || row.user_id === user.id

function inPeriod(iso: string, url: URL) {
  const from = url.searchParams.get('from') ?? url.searchParams.get('filter[from]')
  const to = url.searchParams.get('to') ?? url.searchParams.get('filter[to]')
  return (!from || iso >= from) && (!to || iso <= to)
}

/** Webhook GeniusPay simulé : un remboursement en attente se confirme après quelques secondes. */
function simulateWebhook(r: MockRepayment) {
  if (r.status !== 'pending') return
  setTimeout(() => {
    if (r.status === 'pending') r.status = 'completed'
    recomputeCustomer(r.customer_id)
    persist()
  }, 4000)
}


export const creditsHandlers = [
  // Cartes de « Mes crédits clients » (M09).
  http.get(`${API}/shops/:shopId/credits/summary`, ({ request, params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('credits.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const url = new URL(request.url)
      const credits = db.credits.filter((c) => c.shop_id === shopId)
      credits.forEach(recomputeCredit)
      const open = credits.filter((c) => c.status !== 'cancelled' && c.remaining_amount > 0)
      const newCredits = credits.filter((c) => c.status !== 'cancelled' && !c.is_opening_balance && inPeriod(c.occurred_at, url) && visible(user)(c))
      // Argent reçu sur des crédits : remboursements confirmés, hors avoir (§7.8).
      const repayments = db.repayments.filter((r) => r.shop_id === shopId && r.status === 'completed' && r.payment_method_id !== null && inPeriod(r.received_at, url) && visible(user)(r))
      const overdue = open.flatMap((c) => installmentsOf(c).filter((i) => i.status === 'overdue'))
      return HttpResponse.json({
        data: {
          remaining_total: money(open.reduce((s, c) => s + c.remaining_amount, 0)),
          debtors_count: new Set(open.map((c) => c.customer_id)).size,
          new_credits: { count: newCredits.length, amount: money(newCredits.reduce((s, c) => s + c.amount, 0)) },
          repayments: { count: repayments.length, amount: money(repayments.reduce((s, r) => s + r.amount, 0)) },
          overdue_installments: { count: overdue.length, amount: money(overdue.reduce((s, i) => s + i.amount - i.paid_amount, 0)) },
        },
      })
    }),
  ),

  http.get(`${API}/shops/:shopId/credits/debtors`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('credits.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const byCustomer = new Map<number, MockCredit[]>()
      for (const c of db.credits.filter((x) => x.shop_id === shopId && x.status !== 'cancelled')) {
        recomputeCredit(c)
        byCustomer.set(c.customer_id, [...(byCustomer.get(c.customer_id) ?? []), c])
      }
      const rows: Debtor[] = [...byCustomer.entries()]
        .map(([customerId, credits]) => {
          const ops = [
            ...credits.map((c) => c.occurred_at),
            ...db.repayments.filter((r) => r.customer_id === customerId && r.shop_id === shopId && r.status !== 'cancelled').map((r) => r.received_at),
          ].sort()
          return {
            customer: customerRef(customerId),
            credit_total: money(credits.reduce((s, c) => s + c.amount, 0))!,
            repaid_total: money(credits.reduce((s, c) => s + repaidOf(c), 0))!,
            balance: money(credits.reduce((s, c) => s + c.remaining_amount, 0))!,
            open_credits: credits.filter((c) => c.remaining_amount > 0).length,
            last_operation_at: ops.at(-1) ?? null,
            credit_note_balance: money(creditNoteBalance(customerId, shopId))!,
          }
        })
        .filter((d) => Number(d.balance) > 0)
        .sort((a, b) => Number(b.balance) - Number(a.balance))
      return paginate(request, rows, { searchIn: (d) => `${d.customer.name} ${d.customer.phone ?? ''}` })
    }),
  ),

  // Liste des crédits (« Nouveaux crédits »), du plus récent au plus ancien.
  http.get(`${API}/shops/:shopId/credits`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('credits.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const url = new URL(request.url)
      const rows: CreditListItem[] = db.credits
        .filter((c) => c.shop_id === shopId && inPeriod(c.occurred_at, url) && visible(user)(c))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .map((c) => {
          const d = creditDetail(c)
          return { id: d.id, reference: d.reference, customer: d.customer, sale: d.sale, is_opening_balance: d.is_opening_balance, amount: d.amount, remaining_amount: d.remaining_amount, status: d.status, occurred_at: d.occurred_at }
        })
      return paginate(request, rows, {
        searchIn: (c) => `${c.reference} ${c.customer.name}`,
        filters: { status: (c, v) => c.status === v, customer_id: (c, v) => String(c.customer.id) === v },
      })
    }),
  ),

  // Fiche crédit d'un client, sur les boutiques visibles par l'utilisateur.
  http.get(`${API}/customers/:id/credits`, ({ params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('credits.view')
      const customer = findOr404(db.customers, params.id)
      const shopIds = visibleShopIds(user)
      recomputeCustomer(customer.id)
      const credits = db.credits.filter((c) => c.customer_id === customer.id && shopIds.includes(c.shop_id)).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      const live = credits.filter((c) => c.status !== 'cancelled')
      const data: CustomerCreditFile = {
        customer: { id: customer.id, name: customer.name, phone: customer.phone, district: customer.district },
        totals: {
          credit_total: money(live.reduce((s, c) => s + c.amount, 0))!,
          repaid_total: money(live.reduce((s, c) => s + repaidOf(c), 0))!,
          balance: money(live.reduce((s, c) => s + c.remaining_amount, 0))!,
        },
        balances: shopIds.map((id) => ({ shop: shopRef(id), balance: money(customerBalance(customer.id, [id]))! })),
        credit_note_balance: money(shopIds.reduce((s, id) => s + creditNoteBalance(customer.id, id), 0))!,
        credits: credits.map(creditDetail),
        repayments: db.repayments
          .filter((r) => r.customer_id === customer.id && shopIds.includes(r.shop_id))
          .sort((a, b) => b.received_at.localeCompare(a.received_at))
          .map(repaymentResource),
        refunds: db.customerRefunds.filter((r) => r.customer_id === customer.id && shopIds.includes(r.shop_id)).map(refundResource),
      }
      return HttpResponse.json({ data })
    }),
  ),

  // Solde initial : dette existante saisie sans vente, CR-N (§7.6).
  http.post(`${API}/shops/:shopId/credits/opening-balance`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('credits.opening_balance')
      const shopId = requireShopAccess(user, params.shopId).id
      const body = (await request.json()) as { customer_id?: number; amount?: string; occurred_at?: string; note?: string }
      const v = new Validator()
      const customer = db.customers.find((c) => c.id === Number(body.customer_id) && c.is_active)
      v.check(Boolean(customer), 'customer_id', 'Choisissez un client.')
      const amount = Math.round(Number(String(body.amount ?? '').replace(',', '.')) * 100) / 100
      v.check(amount > 0, 'amount', 'Saisissez le montant de la dette.')
      v.check(!body.occurred_at || body.occurred_at <= new Date().toISOString(), 'occurred_at', 'La date ne peut pas être dans le futur.')
      v.done()
      const credit: MockCredit = {
        id: db.credits.length + 1,
        shop_id: shopId,
        customer_id: customer!.id,
        sale_id: null,
        reference: nextReference('CR'),
        occurred_at: body.occurred_at ? new Date(body.occurred_at).toISOString() : new Date().toISOString(),
        amount,
        remaining_amount: amount,
        is_opening_balance: true,
        status: 'open',
        user_id: user.id,
        note: body.note?.trim() || null,
      }
      db.credits.push(credit)
      audit(user, 'credit.opening_balance', { shopId, subject: { type: 'credit', id: credit.id, label: credit.reference }, reason: credit.note ?? null, new: { client: customer!.name, montant: amount } })
      persist()
      return HttpResponse.json({ data: creditDetail(credit) }, { status: 201 })
    }),
  ),

  http.post(`${API}/shops/:shopId/credits/:id/cancel`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('credits.cancel')
      const shopId = requireShopAccess(user, params.shopId).id
      const credit = findOr404(db.credits.filter((c) => c.shop_id === shopId), params.id)
      const { reason, ...settlement } = (await request.json()) as { reason?: string } & Settlement
      const v = new Validator()
      v.required(reason, 'reason', 'Indiquez pourquoi vous annulez ce crédit.')
      v.done()
      cancelCredit(credit, user, reason!.trim(), settlement)
      audit(user, 'credit.cancelled', { shopId, subject: { type: 'credit', id: credit.id, label: credit.reference }, reason: reason!.trim(), new: { argent_deja_recu: credit.cancel_settlement ? credit.cancel_settlement : null } })
      persist()
      return HttpResponse.json({ data: creditDetail(credit) })
    }),
  ),

  http.post(`${API}/shops/:shopId/credits/:id/adjustments`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('credits.cancel')
      const shopId = requireShopAccess(user, params.shopId).id
      const credit = findOr404(db.credits.filter((c) => c.shop_id === shopId), params.id)
      const body = (await request.json()) as { amount?: string; reason?: string }
      const before = credit.remaining_amount
      adjustCredit(credit, user, body.amount, body.reason)
      audit(user, 'credit.adjusted', { shopId, subject: { type: 'credit', id: credit.id, label: credit.reference }, reason: body.reason ?? null, old: { reste: before }, new: { reste: credit.remaining_amount } })
      persist()
      return HttpResponse.json({ data: creditDetail(credit) })
    }),
  ),

  http.get(`${API}/shops/:shopId/credits/:id/installments`, ({ params }) =>
    handle(async () => {
      await delay(200)
      const user = requirePermission('credits.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const credit = findOr404(db.credits.filter((c) => c.shop_id === shopId), params.id)
      return HttpResponse.json({ data: creditDetail(credit).installments })
    }),
  ),

  http.put(`${API}/shops/:shopId/credits/:id/installments`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('credits.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const credit = findOr404(db.credits.filter((c) => c.shop_id === shopId), params.id)
      const body = (await request.json()) as { installments?: { due_date?: string; amount?: string }[] }
      setInstallments(credit, body.installments ?? [])
      persist()
      return HttpResponse.json({ data: creditDetail(credit) })
    }),
  ),

  // Échéances en retard ou à venir (7 jours) de la boutique.
  http.get(`${API}/shops/:shopId/installments`, ({ request, params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('credits.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const status = new URL(request.url).searchParams.get('status')
      const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
      const rows = db.credits
        .filter((c) => c.shop_id === shopId && c.status !== 'cancelled')
        .flatMap((c) => {
          recomputeCredit(c)
          return installmentsOf(c).map((i) => ({
            ...i,
            amount: money(i.amount)!,
            paid_amount: money(i.paid_amount)!,
            credit: { id: c.id, reference: c.reference },
            customer: customerRef(c.customer_id),
          }))
        })
        .filter((i) => (status === 'overdue' ? i.status === 'overdue' : status === 'upcoming' ? i.status !== 'paid' && i.status !== 'overdue' && i.due_date <= week : i.status !== 'paid'))
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
      return paginate(request, rows, { searchIn: (i) => i.customer.name })
    }),
  ),

  http.post(`${API}/shops/:shopId/repayments`, ({ request, params }) =>
    handle(async () => {
      await delay(450)
      const user = requirePermission('repayments.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const body = (await request.json()) as RepaymentInput
      // Idempotence hors ligne : un second envoi renvoie le remboursement déjà enregistré (ADR-005).
      const existing = body.offline_uuid && db.repayments.find((r) => r.offline_uuid === body.offline_uuid)
      if (existing) return HttpResponse.json({ data: repaymentResource(existing) })
      const repayment = recordRepayment(shopId, user, body)
      persist()
      simulateWebhook(repayment)
      return HttpResponse.json({ data: repaymentResource(repayment) }, { status: 201 })
    }),
  ),

  http.get(`${API}/shops/:shopId/repayments`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('credits.view', 'repayments.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const url = new URL(request.url)
      const rows = db.repayments
        .filter((r) => r.shop_id === shopId && inPeriod(r.received_at, url) && visible(user)(r))
        .sort((a, b) => b.received_at.localeCompare(a.received_at))
        .map(repaymentResource)
      return paginate(request, rows, {
        searchIn: (r) => `${r.reference} ${r.customer.name}`,
        filters: { customer_id: (r, v) => String(r.customer.id) === v, status: (r, v) => r.status === v },
      })
    }),
  ),

  http.get(`${API}/shops/:shopId/repayments/:id`, ({ params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('credits.view', 'repayments.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const r = findOr404(db.repayments.filter((x) => x.shop_id === shopId && visible(user)(x)), params.id)
      return HttpResponse.json({ data: repaymentResource(r) })
    }),
  ),

  http.post(`${API}/shops/:shopId/repayments/:id/cancel`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('repayments.cancel')
      const shopId = requireShopAccess(user, params.shopId).id
      const r = findOr404(db.repayments.filter((x) => x.shop_id === shopId), params.id)
      const { reason } = (await request.json()) as { reason?: string }
      const v = new Validator()
      v.required(reason, 'reason', 'Indiquez pourquoi vous annulez ce paiement.')
      v.done()
      cancelRepayment(r, reason!.trim())
      audit(user, 'repayment.cancelled', { shopId, subject: { type: 'repayment', id: r.id, label: r.reference }, reason: reason!.trim(), old: { montant: r.amount } })
      persist()
      return HttpResponse.json({ data: repaymentResource(r) })
    }),
  ),

  http.get(`${API}/shops/:shopId/repayments/:id/receipt`, ({ params }) =>
    handle(async () => {
      await delay(200)
      const user = requirePermission('credits.view', 'repayments.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const r = findOr404(db.repayments.filter((x) => x.shop_id === shopId && visible(user)(x)), params.id)
      return HttpResponse.json({ data: repaymentReceipt(r) })
    }),
  ),

  http.post(`${API}/shops/:shopId/repayments/:id/share-link`, ({ request, params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('credits.view', 'repayments.create')
      const shopId = requireShopAccess(user, params.shopId).id
      const r = findOr404(db.repayments.filter((x) => x.shop_id === shopId && visible(user)(x)), params.id)
      const { token, exp } = signReceiptToken('r', shopId, r.id)
      const url = `${new URL(request.url).origin}/recu/${token}`
      const rest = customerBalance(r.customer_id, [shopId])
      return HttpResponse.json({
        data: {
          url,
          expires_at: new Date(exp).toISOString(),
          message: `Bonjour, merci pour votre paiement de ${r.amount.toLocaleString('fr-FR')} FCFA à ${db.settings.name} (reçu ${r.reference}). Reste à payer : ${rest.toLocaleString('fr-FR')} FCFA. ${url}`,
        },
      })
    }),
  ),

  // Reçu public (vente ou remboursement), sans connexion : lien signé non expiré (ADR-013).
  http.get(`${API}/public/receipts/:token`, ({ params }) =>
    handle(async () => {
      await delay(250)
      const t = readReceiptToken(String(params.token))
      if (!t) throw new MockHttpError(404, 'Ce lien de reçu n’est pas valide.')
      if (t.exp < Date.now()) throw new MockHttpError(410, 'Ce lien de reçu a expiré. Demandez un nouveau lien à la boutique.')
      if (t.kind === 'r') {
        const r = findOr404(db.repayments.filter((x) => x.shop_id === t.shopId), t.id)
        return HttpResponse.json({ data: { kind: 'repayment', ...repaymentReceipt(r) } })
      }
      const sale = findOr404(db.sales.filter((s) => s.shop_id === t.shopId), t.id)
      return HttpResponse.json({ data: { kind: 'sale', ...receiptResource(sale) } })
    }),
  ),
]
