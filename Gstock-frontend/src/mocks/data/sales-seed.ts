// Historique de démonstration (§11.3) : un mois de ventes, dont une partie à
// crédit, et quelques anciennes dettes. Tout passe par le moteur de vente
// (recordSale) : stock, mouvements et crédits restent cohérents.
import { db, persist } from '../db'
import { recordRepayment, setInstallments } from '../credits'
import { recordExpense, recordPurchase } from '../purchases'
import { recordSale } from '../sales'
import { stockRow } from '../stock'
import { openingBalances } from './customers'
import { STOCK_FIXED } from './products'

/** Générateur pseudo-aléatoire déterministe : la même démo à chaque remise à zéro. */
function prng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Vendeurs par boutique : Aminata (1), Ibrahim (2), Fatou (3, Cocody), Koffi (4, Yopougon).
const SELLERS: Record<number, number[]> = { 1: [3, 3, 2, 1], 2: [4, 4, 2] }

export function seedHistory() {
  if (db.seeded) return
  const rand = prng(20261103)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!

  // Anciennes dettes (CR-N), saisies à la mise en place.
  for (const ob of openingBalances) {
    const n = db.sequences.CR ?? 1
    db.sequences.CR = n + 1
    db.credits.push({
      id: db.credits.length + 1,
      shop_id: ob.shop_id,
      customer_id: ob.customer_id,
      sale_id: null,
      reference: `CR-${n}`,
      occurred_at: '2026-10-01T09:00:00.000Z',
      amount: ob.amount,
      remaining_amount: ob.amount,
      is_opening_balance: true,
      status: 'open',
      user_id: 1,
    })
  }

  // Produits vendables : on garde intacts ceux qui illustrent les alertes de stock.
  const sellable = db.products.filter((p) => p.is_active && p.type !== 'service' && !(p.name in STOCK_FIXED))
  const creditCustomers = [1, 2, 3, 5, 6, 7, 9, 11, 13, 14, 17, 21]

  const start = Date.UTC(2026, 9, 4, 8)
  const days = 30
  for (let d = 0; d < days; d++) {
    for (const shopId of [1, 2]) {
      const count = 4 + Math.floor(rand() * 4)
      for (let k = 0; k < count; k++) {
        const at = new Date(start + d * 86_400_000 + (1 + k * 2 + rand()) * 3_600_000).toISOString()
        const sellerId = pick(SELLERS[shopId]!)
        let user = db.users.find((u) => u.id === sellerId)!
        const items = []
        const used = new Set<number>()
        for (let n = 1 + Math.floor(rand() * 3); n > 0; n--) {
          const p = pick(sellable)
          // On ne vend pas sous le seuil d'alerte : les alertes de la démo restent lisibles.
          const room = stockRow(shopId, p.id).quantity - (p.stock_alert ?? 5) - 1
          if (used.has(p.id) || room < 1) continue
          used.add(p.id)
          items.push({ product_id: p.id, quantity: String(1 + Math.floor(rand() * Math.min(3, room))) })
        }
        if (items.length === 0) continue

        // Total connu après calcul : on choisit d'abord le mode de règlement.
        const r = rand()
        const mode = r < 0.68 ? 'cash' : r < 0.84 ? 'mobile' : r < 0.94 ? 'partial' : 'credit'
        const customer = mode === 'partial' || mode === 'credit' ? pick(creditCustomers) : rand() < 0.3 ? pick(creditCustomers) : null
        const total = items.reduce((s, i) => s + Number(i.quantity) * db.products.find((p) => p.id === i.product_id)!.price, 0)
        const payments =
          mode === 'cash'
            ? [{ payment_method_id: 1, amount: String(total), cash_given: String(Math.ceil(total / 1000) * 1000) }]
            : mode === 'mobile'
              ? [{ payment_method_id: 2, amount: String(total) }]
              : mode === 'partial'
                ? [{ payment_method_id: 1, amount: String(Math.round((total * (0.3 + rand() * 0.4)) / 50) * 50) }]
                : []
        // Une vente à crédit est faite par quelqu'un qui en a le droit (le gérant si besoin).
        if (payments.length === 0 || mode === 'partial') {
          const role = db.roles.find((r) => r.id === user.role_id)
          if (!role?.permissions.includes('credits.create')) user = db.users.find((u) => u.id === 2)!
        }
        try {
          recordSale(shopId, user, { items, payments, customer_id: customer }, at)
        } catch {
          // Stock épuisé entre-temps : la vente n'a pas lieu, comme en boutique.
        }
      }
    }
  }
  // Remboursements partiels quelques jours après le crédit (§11.3), par un utilisateur
  // qui en a le droit (Ibrahim, gérant), en espèces ou Mobile Money.
  const lastDay = Date.UTC(2026, 10, 3, 18)
  const manager = db.users.find((u) => u.id === 2)!
  for (const credit of [...db.credits].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    if (rand() > 0.55) continue
    const at = Date.parse(credit.occurred_at) + (2 + Math.floor(rand() * 8)) * 86_400_000
    if (at > lastDay) continue
    const part = Math.round((credit.remaining_amount * (0.3 + rand() * 0.7)) / 50) * 50
    if (part <= 0) continue
    try {
      recordRepayment(credit.shop_id, manager, {
        customer_id: credit.customer_id,
        amount: String(part),
        payment_method_id: rand() < 0.75 ? 1 : 2,
        received_at: new Date(at).toISOString(),
        allocations: [{ credit_id: credit.id, amount: String(part) }],
      })
    } catch {
      // Montant devenu supérieur au reste : on passe.
    }
  }

  // Quelques échéanciers, dont une échéance déjà dépassée (§7.7).
  const scheduled = db.credits.filter((c) => c.status !== 'settled' && c.remaining_amount >= 1500).slice(0, 4)
  scheduled.forEach((credit, i) => {
    const half = Math.round(credit.remaining_amount / 2 / 50) * 50
    try {
      setInstallments(credit, [
        { due_date: i % 2 === 0 ? '2026-10-30' : '2026-11-06', amount: String(half) },
        { due_date: '2026-11-15', amount: String(credit.remaining_amount - half) },
      ])
    } catch {
      // Reste invalide pour un échéancier : on passe.
    }
  })

  // Approvisionnements (M11) : arrivages réguliers, une partie payée plus tard.
  const stockKeeper = db.users.find((u) => u.id === 5)!
  const arrivals: { day: number; shop: number; supplier: number; items: [string, number][]; paid: number }[] = [
    { day: 8, shop: 1, supplier: 1, items: [['Riz local 1 kg', 20], ['Spaghetti 500 g', 24], ['Couscous 1 kg', 10]], paid: 1 },
    { day: 12, shop: 2, supplier: 2, items: [['Huile de palme 1 L', 12], ['Huile d’arachide 1 L', 6]], paid: 0.5 },
    { day: 16, shop: 1, supplier: 3, items: [['Eau minérale 1,5 L', 48], ['Fanta orange 33 cl', 24], ['Jus de bissap 1 L', 12]], paid: 1 },
    { day: 21, shop: 2, supplier: 4, items: [['Sucre en poudre 1 kg', 20], ['Farine de blé 1 kg', 15], ['Lait concentré sucré', 24]], paid: 0 },
    { day: 25, shop: 1, supplier: 5, items: [['Dentifrice 75 ml', 12], ['Papier toilette (4 rouleaux)', 10], ['Savon Lux', 24]], paid: 0.4 },
    { day: 28, shop: 2, supplier: 1, items: [['Riz local 1 kg', 15], ['Tomate concentrée 70 g', 40]], paid: 1 },
  ]
  for (const a of arrivals) {
    const items = a.items.flatMap(([name, quantity]) => {
      const p = db.products.find((x) => x.name === name)
      return p ? [{ product_id: p.id, quantity: String(quantity), cost: String(p.cost ?? 0) }] : []
    })
    const total = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.cost), 0)
    const paid = Math.round((total * a.paid) / 50) * 50
    try {
      recordPurchase(a.shop, stockKeeper, {
        items,
        supplier_id: a.supplier,
        occurred_at: new Date(Date.UTC(2026, 9, a.day, 9)).toISOString(),
        ...(paid > 0 ? { paid_amount: String(paid), payment_method_id: 1 } : {}),
      })
    } catch {
      // Données incohérentes : on passe.
    }
  }

  // Dépenses (M12) : loyer, électricité, transport, personnel…
  const spender = db.users.find((u) => u.id === 1)!
  const expenses: [number, number, number, number, string | null][] = [
    // [jour d'octobre, boutique, catégorie, montant, note]
    [5, 1, 3, 75000, 'Loyer d’octobre'], [5, 2, 3, 60000, 'Loyer d’octobre'],
    [9, 1, 1, 3000, 'Taxi pour le marché'], [11, 2, 1, 2500, null],
    [14, 1, 2, 18500, 'Facture CIE'], [14, 2, 2, 15200, 'Facture CIE'],
    [18, 1, 4, 10000, 'Forfait internet'], [22, 2, 1, 4000, 'Livraison'],
    [30, 1, 5, 40000, 'Aide de Fatou'], [30, 2, 5, 35000, null],
    [31, 1, 6, 1500, 'Sacs plastiques'], [32, 2, 6, 2000, 'Balai et seau'],
  ]
  for (const [day, shop, category, amount, note] of expenses) {
    try {
      recordExpense(shop, spender, { expense_category_id: category, amount: String(amount), payment_method_id: 1, occurred_at: new Date(Date.UTC(2026, 9, day, 17)).toISOString(), note })
    } catch {
      // Date future, etc. : on passe.
    }
  }

  db.seeded = true
  persist()
}
