// Règles de vente du serveur (§7.4, §7.5), partagées par la caisse simulée et le
// jeu de démonstration : montants recalculés, crédit automatique, stock en sortie.
import type { PaymentStatus, SaleLineInput, SalePaymentInput, SaleQuote, SaleQuoteInput } from '@/types/sales'
import type { MockCredit } from './data/customers'
import type { MockProduct } from './data/products'
import type { MockUser } from './data/users'
import { db, nextReference } from './db'
import { MockHttpError, permissionsOf, Validator } from './http'
import { applyStockChanges, money, qty, stockRow } from './stock'

export interface MockSaleItem {
  product_id: number
  quantity: number
  price: number
  discount: number
  discount_method: 'percent' | 'fixed' | null
  discount_amount: number
  tax_rate: number | null
  tax_amount: number
  unit_cost: number | null
  subtotal: number
}

export interface MockSalePayment {
  id: number
  payment_method_id: number
  amount: number
  cash_given: number | null
  change: number | null
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
}

export interface MockSale {
  id: number
  shop_id: number
  reference: string
  offline_uuid: string | null
  occurred_at: string
  customer_id: number | null
  user_id: number
  items: MockSaleItem[]
  subtotal: number
  discount: number
  tax_amount: number
  total: number
  paid_now: number
  credit_amount: number
  payment_status: PaymentStatus
  status: 'completed' | 'cancelled'
  payments: MockSalePayment[]
  note: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : Number(String(v).replace(',', '.')))

interface Computed {
  items: (MockSaleItem & { product: MockProduct })[]
  subtotal: number
  discount: number
  tax_amount: number
  total: number
  payments: Omit<MockSalePayment, 'id' | 'status'>[]
  paid_now: number
  change: number
  credit_amount: number
  payment_status: PaymentStatus
}

/**
 * Calcule une vente comme le serveur (§7.4) : prix, remises, taxes par ligne,
 * remise globale, paiements, rendu sur les espèces, reste à crédit.
 * `user` sert à vérifier les droits de remise et de changement de prix.
 */
export function computeSale(input: SaleQuoteInput, user: MockUser): Computed {
  const perms = permissionsOf(user)
  const v = new Validator()
  const lines = input.items ?? []
  v.check(lines.length > 0, 'items', 'Le panier est vide.')

  const items = lines.flatMap((line: SaleLineInput) => {
    const product = db.products.find((p) => p.id === Number(line.product_id) && p.is_active)
    if (!product) {
      v.add('items', 'Un produit du panier n’est plus disponible.')
      return []
    }
    const quantity = num(line.quantity)
    if (!(quantity > 0)) v.add('items', `Quantité invalide pour ${product.name}.`)

    let price = product.price
    if (line.price !== undefined && num(line.price) !== product.price) {
      if (!perms.includes('sales.edit_price')) throw new MockHttpError(403, "Vous n'avez pas le droit de modifier un prix.")
      price = num(line.price)
      if (!(price >= 0)) v.add('items', `Prix invalide pour ${product.name}.`)
    }

    const discount = line.discount ? num(line.discount) : 0
    const method = discount > 0 ? (line.discount_method ?? 'fixed') : null
    if (discount > 0 && !perms.includes('sales.give_discount')) throw new MockHttpError(403, "Vous n'avez pas le droit de faire une remise.")
    const discountAmount = round2(method === 'percent' ? (price * Math.min(discount, 100)) / 100 : Math.min(discount, price))
    const discounted = price - discountAmount
    // Taxe exclusive, option avancée (désactivée par défaut).
    const taxRate = product.tax_rate
    const tax = taxRate ? round2((discounted * taxRate) / 100) : 0
    return [
      {
        product,
        product_id: product.id,
        quantity,
        price,
        discount,
        discount_method: method,
        discount_amount: discountAmount,
        tax_rate: taxRate,
        tax_amount: round2(tax * quantity),
        unit_cost: product.cost,
        subtotal: round2(quantity * (discounted + tax)),
      },
    ]
  })

  const totalLines = round2(items.reduce((s, i) => s + i.subtotal, 0))
  const globalDiscount = input.discount ? num(input.discount) : 0
  if (globalDiscount > 0 && !perms.includes('sales.give_discount')) throw new MockHttpError(403, "Vous n'avez pas le droit de faire une remise.")
  v.check(!(globalDiscount < 0) && globalDiscount <= totalLines, 'discount', 'La remise ne peut pas dépasser le total.')
  const discount = round2(Math.min(Math.max(globalDiscount || 0, 0), totalLines))
  const total = round2(totalLines - discount)

  const payments = (input.payments ?? []).map((p: SalePaymentInput) => {
    const method = db.paymentMethods.find((m) => m.id === Number(p.payment_method_id) && m.is_active)
    if (!method) v.add('payments', 'Ce mode de paiement n’est pas disponible.')
    const amount = round2(num(p.amount))
    if (!(amount > 0)) v.add('payments', 'Saisissez un montant supérieur à 0.')
    const given = method?.type === 'cash' && p.cash_given ? round2(num(p.cash_given)) : null
    if (given !== null && given < amount) v.add('payments', 'La somme donnée est inférieure au montant payé en espèces.')
    return {
      payment_method_id: Number(p.payment_method_id),
      amount,
      cash_given: given,
      change: given !== null ? round2(given - amount) : null,
    }
  })
  const paidNow = round2(payments.reduce((s, p) => s + (p.amount || 0), 0))
  v.check(paidNow <= total, 'payments', 'L’argent reçu dépasse le total : saisissez le rendu en espèces.')
  v.done()

  // Montant à crédit = total − payé immédiatement (§7.5).
  const credit = round2(total - paidNow)
  return {
    items,
    subtotal: totalLines,
    discount,
    tax_amount: round2(items.reduce((s, i) => s + i.tax_amount, 0)),
    total,
    payments,
    paid_now: paidNow,
    change: round2(payments.reduce((s, p) => s + (p.change ?? 0), 0)),
    credit_amount: credit,
    payment_status: credit === 0 ? 'paid' : paidNow === 0 ? 'credit' : 'partial',
  }
}

export function quoteResource(c: Computed): SaleQuote {
  return {
    items: c.items.map((i) => ({
      product_id: i.product_id,
      quantity: qty(i.quantity),
      price: money(i.price)!,
      discount_amount: money(i.discount_amount)!,
      subtotal: money(i.subtotal)!,
    })),
    subtotal: money(c.subtotal)!,
    discount: money(c.discount)!,
    tax_amount: money(c.tax_amount)!,
    total: money(c.total)!,
    paid_now: money(c.paid_now)!,
    credit_amount: money(c.credit_amount)!,
    change: money(c.change)!,
    payment_status: c.payment_status,
  }
}

/**
 * Enregistre une vente « en transaction » : stock vérifié et diminué, paiements,
 * crédit client si un reste existe (§7.1, §7.5). Rien n'est écrit en cas d'erreur.
 */
export function recordSale(
  shopId: number,
  user: MockUser,
  input: SaleQuoteInput & { customer_id?: number | null; note?: string | null; offline_uuid?: string | null },
  occurredAt = new Date().toISOString(),
): MockSale {
  const c = computeSale(input, user)
  const customerId = input.customer_id ? Number(input.customer_id) : null
  const customer = customerId ? db.customers.find((x) => x.id === customerId && x.is_active) : null
  if (customerId && !customer) throw new MockHttpError(422, 'Ce client n’existe pas.', { customer_id: ['Ce client n’existe pas.'] })
  if (c.credit_amount > 0) {
    // Un reste à payer exige un client identifiable (§7.1) et le droit de mettre à crédit.
    if (!customer) throw new MockHttpError(422, 'Choisissez un client pour mettre à crédit.', { customer_id: ['Choisissez un client pour mettre à crédit.'] })
    if (!permissionsOf(user).includes('credits.create')) throw new MockHttpError(403, "Vous n'avez pas le droit de mettre à crédit.")
  }

  const id = db.sales.length ? Math.max(...db.sales.map((s) => s.id)) + 1 : 1
  const reference = `V-${db.sequences.V ?? 1}`
  // Le stock diminue dès la validation, payée ou à crédit (§7.1).
  applyStockChanges(
    c.items.map((i) => ({ shopId, product: i.product, delta: -i.quantity })),
    { source_type: 'sale', source_id: id, reference, reason: null, user_id: user.id, occurred_at: occurredAt },
  )
  nextReference('V')

  const geniuspay = db.paymentSettings.is_active
  let paymentId = db.sales.reduce((m, s) => Math.max(m, ...s.payments.map((p) => p.id), 0), 0)
  const sale: MockSale = {
    id,
    shop_id: shopId,
    reference,
    offline_uuid: input.offline_uuid ?? null,
    occurred_at: occurredAt,
    customer_id: customer?.id ?? null,
    user_id: user.id,
    items: c.items.map(({ product: _p, ...i }) => i),
    subtotal: c.subtotal,
    discount: c.discount,
    tax_amount: c.tax_amount,
    total: c.total,
    paid_now: c.paid_now,
    credit_amount: c.credit_amount,
    payment_status: c.payment_status,
    status: 'completed',
    payments: c.payments.map((p) => {
      const method = db.paymentMethods.find((m) => m.id === p.payment_method_id)!
      // GeniusPay : validé seulement à réception du webhook (ADR-003).
      return { id: ++paymentId, ...p, status: geniuspay && method.uses_geniuspay ? 'pending' : 'completed' }
    }),
    note: input.note?.trim() || null,
    cancelled_at: null,
    cancel_reason: null,
  }
  db.sales.push(sale)

  if (c.credit_amount > 0 && customer) {
    db.credits.push({
      id: db.credits.length + 1,
      shop_id: shopId,
      customer_id: customer.id,
      sale_id: sale.id,
      reference,
      occurred_at: occurredAt,
      amount: c.credit_amount,
      remaining_amount: c.credit_amount,
      is_opening_balance: false,
      status: 'open',
      user_id: user.id,
    })
  }
  return sale
}

/** Annulation d'une vente : stock restitué, crédit annulé (§7.2, §7.6, ADR-012). */
export function cancelSale(sale: MockSale, user: MockUser, reason: string) {
  if (sale.status === 'cancelled') throw new MockHttpError(409, 'Cette vente a déjà été annulée.')
  const credit = db.credits.find((c) => c.sale_id === sale.id)
  if (credit && credit.remaining_amount < credit.amount) {
    // P3 : les remboursements déjà reçus deviendront un avoir (F5).
    throw new MockHttpError(409, 'Cette vente a déjà reçu des remboursements : annulez-les d’abord.')
  }
  const now = new Date().toISOString()
  applyStockChanges(
    sale.items.map((i) => ({ shopId: sale.shop_id, product: db.products.find((p) => p.id === i.product_id)!, delta: i.quantity })),
    { source_type: 'sale_cancel', source_id: sale.id, reference: sale.reference, reason: `Annulation : ${reason}`, user_id: user.id, occurred_at: now },
  )
  Object.assign(sale, { status: 'cancelled', cancelled_at: now, cancel_reason: reason })
  for (const p of sale.payments) p.status = 'cancelled'
  if (credit) Object.assign(credit, { status: 'cancelled', remaining_amount: 0 })
}

/** Reste dû d'un client : Σ restes de ses crédits ouverts (§7.6). */
export function customerBalance(customerId: number, shopIds?: number[]): number {
  return round2(
    db.credits
      .filter((c: MockCredit) => c.customer_id === customerId && c.status !== 'cancelled' && (!shopIds || shopIds.includes(c.shop_id)))
      .reduce((s, c) => s + c.remaining_amount, 0),
  )
}

export function availableQuantity(shopId: number, productId: number) {
  return stockRow(shopId, productId).quantity
}
