// Règles de stock du serveur (§7.2), partagées par les handlers :
// quantité = somme des mouvements, jamais négative, contrôle « en transaction ».
import type { StockState } from '@/types/catalog'
import type { MockMovement, MockProduct, MockVariant } from './data/products'
import type { MockUser } from './data/users'
import { db } from './db'
import { isOwner, MockHttpError, permissionsOf } from './http'

/** Quantité au format décimal de l'API (NUMERIC, 3 décimales). */
export const qty = (n: number) => n.toFixed(3)
export const money = (n: number | null) => (n === null ? null : n.toFixed(2))

export function stockState(quantity: number, alert: number | null): StockState {
  if (quantity <= 0) return 'out'
  if (alert !== null && quantity <= alert) return 'low'
  return 'ok'
}

/** Seuil effectif : surcharge de la boutique, sinon celui du produit (le même pour chaque variante). */
export function alertOf(product: MockProduct, shopId: number, variantId: number | null = null): number | null {
  const row = db.shopStock.find((s) => s.shop_id === shopId && s.product_id === product.id && (s.variant_id ?? null) === variantId)
  return row?.stock_alert ?? product.stock_alert
}

/** Ligne de stock (produit, variante, boutique), créée à 0 si elle manque (§7.2). */
export function stockRow(shopId: number, productId: number, variantId: number | null = null) {
  let row = db.shopStock.find((s) => s.shop_id === shopId && s.product_id === productId && (s.variant_id ?? null) === variantId)
  if (!row) {
    row = { shop_id: shopId, product_id: productId, variant_id: variantId, quantity: 0, stock_alert: null }
    db.shopStock.push(row)
  }
  return row
}

/** Ce qui porte du stock : le produit lui-même, ou chacune de ses variantes. */
export function stockKeys(product: MockProduct): (number | null)[] {
  if (product.type === 'service') return []
  return product.type === 'variable' ? (product.variants ?? []).map((v) => v.id) : [null]
}

/** Stock total d'un produit dans une boutique (somme des variantes). */
export function productQuantity(shopId: number, product: MockProduct): number {
  return stockKeys(product).reduce<number>((s, v) => s + stockRow(shopId, product.id, v).quantity, 0)
}

export function variantOf(product: MockProduct, variantId: number | null | undefined): MockVariant | undefined {
  return variantId ? product.variants?.find((v) => v.id === Number(variantId)) : undefined
}

/** Nom affiché d'un article : « Jus de fruits 1 L — Bissap ». */
export function itemName(product: MockProduct, variantId?: number | null): string {
  const variant = variantOf(product, variantId)
  return variant ? `${product.name} — ${variant.name}` : product.name
}

/** Référence de variante pour l'API. */
export function variantRef(product: MockProduct, variantId?: number | null) {
  const variant = variantOf(product, variantId)
  return variant ? { id: variant.id, name: variant.name } : null
}

/**
 * Article vendable ou achetable : un produit simple, ou une variante active d'un produit
 * `variable`. Ajoute un message en français à `errors` sinon.
 */
export function resolveArticle(product: MockProduct, variantId: unknown, errors: { add: (field: string, message: string) => void }, field = 'items') {
  if (product.type !== 'variable') return { variantId: null, variant: undefined, name: product.name, price: product.price, cost: product.cost, barcode: product.barcode }
  const variant = variantId ? product.variants?.find((v) => v.id === Number(variantId) && v.is_active) : undefined
  if (!variant) {
    errors.add(field, `Choisissez la variante de ${product.name}.`)
    return null
  }
  return { variantId: variant.id, variant, name: itemName(product, variant.id), price: variant.price, cost: variant.cost, barcode: variant.barcode }
}

/**
 * Vérifie que l'utilisateur est affecté à la boutique (§6.2, M04) :
 * 403 sinon, même si l'endpoint est appelé directement.
 */
export function requireShopAccess(user: MockUser, shopIdParam: unknown) {
  const shop = db.shops.find((s) => s.id === Number(shopIdParam))
  if (!shop) throw new MockHttpError(404, "Cette boutique n'existe pas.")
  if (!isOwner(user) && !user.shop_ids.includes(shop.id)) {
    throw new MockHttpError(403, "Vous n'avez pas accès à cette boutique.")
  }
  if (!shop.is_active) throw new MockHttpError(403, 'Cette boutique est fermée.')
  return shop
}

/** Sans records.view_all, on ne voit que ses propres opérations (§6.2). */
export function canSeeAll(user: MockUser) {
  return permissionsOf(user).includes('records.view_all')
}

export interface StockChange {
  shopId: number
  product: MockProduct
  /** Variante d'un produit `variable`. */
  variantId?: number | null
  delta: number
}

/**
 * Applique plusieurs variations « dans une transaction » : on vérifie tout
 * d'abord, et on n'écrit rien si une seule ligne passerait sous zéro (§7.2).
 */
export function applyStockChanges(
  changes: StockChange[],
  meta: Omit<MockMovement, 'id' | 'shop_id' | 'product_id' | 'quantity' | 'unit_cost'>,
) {
  // Deux lignes sur le même article : le contrôle porte sur leur total.
  const totals = new Map<string, { change: StockChange; delta: number }>()
  for (const change of changes) {
    if (change.product.type === 'service') continue
    const key = `${change.shopId}:${change.product.id}:${change.variantId ?? ''}`
    const entry = totals.get(key) ?? { change, delta: 0 }
    entry.delta += change.delta
    totals.set(key, entry)
  }
  for (const { change, delta } of totals.values()) {
    const { shopId, product, variantId = null } = change
    if (product.type === 'variable' && !variantOf(product, variantId)) throw new MockHttpError(422, `Choisissez la variante de ${product.name}.`, { items: [`Choisissez la variante de ${product.name}.`] })
    const row = stockRow(shopId, product.id, variantId)
    if (row.quantity + delta < 0) {
      const unit = db.units.find((u) => u.id === product.unit_id)
      const message = `Stock insuffisant : il reste ${formatQty(row.quantity)} ${unit?.short_name ?? ''} de ${itemName(product, variantId)}.`
      throw new MockHttpError(422, message, { items: [message] })
    }
  }
  for (const { shopId, product, variantId = null, delta } of changes) {
    if (product.type === 'service' || delta === 0) continue
    stockRow(shopId, product.id, variantId).quantity += delta
    db.movements.push({
      id: db.movements.length + 1,
      shop_id: shopId,
      product_id: product.id,
      variant_id: variantId,
      quantity: delta,
      unit_cost: variantOf(product, variantId)?.cost ?? product.cost,
      ...meta,
    })
  }
}

function formatQty(n: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n)
}

export const userName = (id: number | null) => {
  const u = db.users.find((x) => x.id === id)
  return u ? { id: u.id, name: `${u.firstname} ${u.lastname}` } : null
}
