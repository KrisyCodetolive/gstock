// Règles d'approvisionnement et de dépense du serveur (M11, M12, §7.2, §7.4).
import type { PurchaseQuoteInput } from '@/types/purchases'
import type { MockExpense, MockPurchase } from './data/purchases'
import type { MockUser } from './data/users'
import { db, nextReference } from './db'
import { MockHttpError, Validator } from './http'
import { applyStockChanges } from './stock'
import { unitFactor, unitFamily } from './units'

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : Number(String(v).replace(',', '.')))
const now = () => new Date().toISOString()

/** Montants d'un approvisionnement, recalculés par le serveur (§7.4). */
export function computePurchase(input: PurchaseQuoteInput) {
  const v = new Validator()
  const lines = input.items ?? []
  v.check(lines.length > 0, 'items', 'Ajoutez au moins un produit.')
  const ids = lines.map((l) => Number(l.product_id))
  v.check(new Set(ids).size === ids.length, 'items', 'Un même produit apparaît deux fois.')
  const items = lines.flatMap((l) => {
    const product = db.products.find((p) => p.id === Number(l.product_id) && p.is_active)
    if (!product || product.type === 'service') {
      v.add('items', 'Un des produits ne peut pas être approvisionné.')
      return []
    }
    const quantity = num(l.quantity)
    const cost = num(l.cost)
    if (!(quantity > 0)) v.add('items', `Saisissez une quantité supérieure à 0 pour ${product.name}.`)
    if (!(cost >= 0)) v.add('items', `Saisissez le prix d'achat de ${product.name}.`)
    // Unité de la ligne : l'unité de base du produit ou une de ses unités dérivées (§7.3).
    const unit = l.unit_id ? unitFamily(product.unit_id).find((u) => u.id === Number(l.unit_id)) : db.units.find((u) => u.id === product.unit_id)
    if (!unit) {
      v.add('items', `Cette unité ne convient pas pour ${product.name}.`)
      return []
    }
    // Le stock est tenu en unité de base, arrondi au millième (§7.2).
    const base_quantity = Math.round(quantity * unitFactor(unit) * 1000) / 1000
    return [{ product, product_id: product.id, unit, unit_id: unit.id, quantity, base_quantity, cost: round2(cost), subtotal: round2(quantity * cost) }]
  })
  const subtotal = round2(items.reduce((s, i) => s + (i.subtotal || 0), 0))
  const discount = input.discount ? round2(num(input.discount)) : 0
  v.check(!(discount < 0) && discount <= subtotal, 'discount', 'La remise ne peut pas dépasser le total.')
  v.done()
  return { items, subtotal, discount, total: round2(subtotal - discount) }
}

export function paidOf(p: MockPurchase) {
  return round2(p.payments.filter((x) => x.status === 'completed').reduce((s, x) => s + x.amount, 0))
}

export function purchaseState(p: MockPurchase) {
  const paid = paidOf(p)
  const due = p.status === 'cancelled' ? 0 : round2(Math.max(p.total - paid, 0))
  const payment_status = due === 0 ? 'paid' : paid === 0 ? 'unpaid' : 'partial'
  return { paid, due, payment_status: payment_status as 'paid' | 'partial' | 'unpaid' }
}

function checkPayment(amount: number, methodId: unknown, due: number, v: Validator) {
  v.check(amount > 0, 'paid_amount', 'Saisissez un montant supérieur à 0.')
  v.check(amount <= due, 'paid_amount', `Il ne reste que ${due.toLocaleString('fr-FR')} FCFA à payer.`)
  v.check(db.paymentMethods.some((m) => m.id === Number(methodId) && m.is_active), 'payment_method_id', 'Choisissez le mode de paiement.')
}

/**
 * Enregistre un approvisionnement AP-N : le stock augmente tout de suite (M11),
 * le prix d'achat des produits peut être mis à jour, un premier paiement est possible.
 */
export function recordPurchase(
  shopId: number,
  user: MockUser,
  input: PurchaseQuoteInput & { supplier_id?: number | null; occurred_at?: string; note?: string | null; paid_amount?: string; payment_method_id?: number | null; update_costs?: boolean },
): MockPurchase {
  const c = computePurchase(input)
  const v = new Validator()
  const supplier = input.supplier_id ? db.suppliers.find((s) => s.id === Number(input.supplier_id) && s.is_active) : null
  if (input.supplier_id) v.check(Boolean(supplier), 'supplier_id', 'Ce fournisseur n’existe pas.')
  const occurredAt = input.occurred_at && !Number.isNaN(Date.parse(input.occurred_at)) ? new Date(input.occurred_at).toISOString() : now()
  v.check(occurredAt <= now(), 'occurred_at', 'La date ne peut pas être dans le futur.')
  const paid = input.paid_amount ? round2(num(input.paid_amount)) : 0
  if (paid > 0) checkPayment(paid, input.payment_method_id, c.total, v)
  v.done()

  const id = db.purchases.length + 1
  const reference = `AP-${db.sequences.AP ?? 1}`
  // Entrée en stock, en unité de base (§7.2).
  applyStockChanges(
    c.items.map((i) => ({ shopId, product: i.product, delta: i.base_quantity })),
    { source_type: 'purchase', source_id: id, reference, reason: supplier ? supplier.name : null, user_id: user.id, occurred_at: occurredAt },
  )
  nextReference('AP')
  // Le prix d'achat du produit est tenu par unité de base : prix du carton ÷ 12.
  if (input.update_costs) for (const i of c.items) i.product.cost = round2(i.cost / unitFactor(i.unit))

  const purchase: MockPurchase = {
    id,
    shop_id: shopId,
    supplier_id: supplier?.id ?? null,
    reference,
    occurred_at: occurredAt,
    items: c.items.map(({ product: _p, unit: _u, ...i }) => i),
    subtotal: c.subtotal,
    discount: c.discount,
    total: c.total,
    status: 'received',
    payments: paid > 0 ? [{ id: 1, amount: paid, payment_method_id: Number(input.payment_method_id), paid_at: occurredAt, note: null, user_id: user.id, status: 'completed' }] : [],
    note: input.note?.trim() || null,
    user_id: user.id,
    cancelled_at: null,
    cancel_reason: null,
  }
  db.purchases.push(purchase)
  return purchase
}

/** Paiement ultérieur au fournisseur, jamais au-delà du reste dû. */
export function addPurchasePayment(purchase: MockPurchase, user: MockUser, body: { amount?: string; payment_method_id?: number; paid_at?: string; note?: string }) {
  if (purchase.status === 'cancelled') throw new MockHttpError(409, 'Cet approvisionnement est annulé.')
  const v = new Validator()
  const amount = round2(num(body.amount))
  checkPayment(amount, body.payment_method_id, purchaseState(purchase).due, v)
  v.done()
  purchase.payments.push({
    id: purchase.payments.length + 1,
    amount,
    payment_method_id: Number(body.payment_method_id),
    paid_at: body.paid_at && !Number.isNaN(Date.parse(body.paid_at)) ? new Date(body.paid_at).toISOString() : now(),
    note: body.note?.trim() || null,
    user_id: user.id,
    status: 'completed',
  })
}

/**
 * Annulation : la marchandise sort du stock (refusé si le stock deviendrait
 * négatif, §7.2) ; l'approvisionnement reste visible, marqué « annulé » (ADR-012).
 */
export function cancelPurchase(purchase: MockPurchase, user: MockUser, reason: string) {
  if (purchase.status === 'cancelled') throw new MockHttpError(409, 'Cet approvisionnement a déjà été annulé.')
  applyStockChanges(
    purchase.items.map((i) => ({ shopId: purchase.shop_id, product: db.products.find((p) => p.id === i.product_id)!, delta: -(i.base_quantity ?? i.quantity) })),
    { source_type: 'purchase_cancel', source_id: purchase.id, reference: purchase.reference, reason: `Annulation : ${reason}`, user_id: user.id, occurred_at: now() },
  )
  Object.assign(purchase, { status: 'cancelled', cancelled_at: now(), cancel_reason: reason })
}

/** Dépense DP-N (M12). */
export function recordExpense(
  shopId: number,
  user: MockUser,
  body: { expense_category_id?: number; amount?: string; payment_method_id?: number; occurred_at?: string; note?: string | null; offline_uuid?: string },
): MockExpense {
  const v = new Validator()
  v.check(db.expenseCategories.some((c) => c.id === Number(body.expense_category_id) && c.is_active), 'expense_category_id', 'Choisissez une catégorie.')
  const amount = round2(num(body.amount))
  v.check(amount > 0, 'amount', 'Saisissez le montant de la dépense.')
  v.check(db.paymentMethods.some((m) => m.id === Number(body.payment_method_id) && m.is_active), 'payment_method_id', 'Choisissez le mode de paiement.')
  const occurredAt = body.occurred_at && !Number.isNaN(Date.parse(body.occurred_at)) ? new Date(body.occurred_at).toISOString() : now()
  v.check(occurredAt <= now(), 'occurred_at', 'La date ne peut pas être dans le futur.')
  v.done()
  const expense: MockExpense = {
    id: db.expenses.length + 1,
    shop_id: shopId,
    reference: nextReference('DP'),
    offline_uuid: body.offline_uuid ?? null,
    occurred_at: occurredAt,
    expense_category_id: Number(body.expense_category_id),
    amount,
    payment_method_id: Number(body.payment_method_id),
    note: body.note?.trim() || null,
    user_id: user.id,
    status: 'completed',
    cancelled_at: null,
    cancel_reason: null,
  }
  db.expenses.push(expense)
  return expense
}

export function cancelExpense(expense: MockExpense, reason: string) {
  if (expense.status === 'cancelled') throw new MockHttpError(409, 'Cette dépense a déjà été annulée.')
  Object.assign(expense, { status: 'cancelled', cancelled_at: now(), cancel_reason: reason })
}
