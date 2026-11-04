// Calcul provisoire d'une vente sur l'appareil, seulement sans réseau (ADR-005).
// Mêmes règles que POST /sales/quote (§7.4, §7.5) ; le serveur recalcule tout à la
// synchronisation, et ce montant est toujours affiché comme provisoire.
import { ApiError } from '@/lib/api/client'
import type { PosBootstrap, SaleQuote, SaleQuoteInput } from '@/types/sales'

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : Number(String(v).replace(',', '.')))
const money = (n: number) => n.toFixed(2)

function invalid(field: string, message: string): never {
  throw new ApiError(422, { message, errors: { [field]: [message] } })
}

export type ProvisionalQuote = SaleQuote & { provisional: true }

export function localQuote(input: SaleQuoteInput, bootstrap: PosBootstrap): ProvisionalQuote {
  if (input.items.length === 0) invalid('items', 'Le panier est vide.')
  const items = input.items.map((line) => {
    // Un article par produit, ou par variante : on compare aussi la variante.
    const product = bootstrap.products.find((p) => p.id === line.product_id && p.variant_id === (line.variant_id ?? null))
    if (!product) invalid('items', 'Un produit du panier n’est plus disponible.')
    const quantity = num(line.quantity)
    if (!(quantity > 0)) invalid('items', `Quantité invalide pour ${product.name}.`)
    const price = line.price !== undefined ? num(line.price) : num(product.price)
    const discount = line.discount ? num(line.discount) : 0
    const method = discount > 0 ? (line.discount_method ?? 'fixed') : null
    const discountAmount = round2(method === 'percent' ? (price * Math.min(discount, 100)) / 100 : Math.min(discount, price))
    const discounted = price - discountAmount
    const taxRate = product.tax_rate ? num(product.tax_rate) : 0
    const tax = taxRate ? round2((discounted * taxRate) / 100) : 0
    return { product_id: product.id, variant_id: product.variant_id, quantity, price, discountAmount, tax: round2(tax * quantity), subtotal: round2(quantity * (discounted + tax)) }
  })

  const totalLines = round2(items.reduce((s, i) => s + i.subtotal, 0))
  const globalDiscount = input.discount ? num(input.discount) : 0
  if (globalDiscount > totalLines) invalid('discount', 'La remise ne peut pas dépasser le total.')
  const discount = round2(Math.max(globalDiscount || 0, 0))
  const total = round2(totalLines - discount)

  let change = 0
  const paidNow = round2(
    (input.payments ?? []).reduce((sum, p) => {
      const method = bootstrap.payment_methods.find((m) => m.id === p.payment_method_id)
      const amount = round2(num(p.amount))
      if (!(amount > 0)) invalid('payments', 'Saisissez un montant supérieur à 0.')
      if (method?.type === 'cash' && p.cash_given) {
        const given = round2(num(p.cash_given))
        if (given < amount) invalid('payments', 'La somme donnée est inférieure au montant payé en espèces.')
        change += given - amount
      }
      return sum + amount
    }, 0),
  )
  if (paidNow > total) invalid('payments', 'L’argent reçu dépasse le total : saisissez le rendu en espèces.')
  const credit = round2(total - paidNow)

  return {
    items: items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity.toFixed(3), price: money(i.price), discount_amount: money(i.discountAmount), subtotal: money(i.subtotal) })),
    subtotal: money(totalLines),
    discount: money(discount),
    tax_amount: money(round2(items.reduce((s, i) => s + i.tax, 0))),
    total: money(total),
    paid_now: money(paidNow),
    credit_amount: money(credit),
    change: money(round2(change)),
    payment_status: credit === 0 ? 'paid' : paidNow === 0 ? 'credit' : 'partial',
    provisional: true,
  }
}
