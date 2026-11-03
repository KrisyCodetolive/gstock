// Règles de stock du serveur (§7.2), partagées par les handlers :
// quantité = somme des mouvements, jamais négative, contrôle « en transaction ».
import type { StockState } from '@/types/catalog'
import type { MockMovement, MockProduct } from './data/products'
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

/** Seuil effectif : surcharge de la boutique, sinon celui du produit. */
export function alertOf(product: MockProduct, shopId: number): number | null {
  const row = db.shopStock.find((s) => s.shop_id === shopId && s.product_id === product.id)
  return row?.stock_alert ?? product.stock_alert
}

export function stockRow(shopId: number, productId: number) {
  let row = db.shopStock.find((s) => s.shop_id === shopId && s.product_id === productId)
  if (!row) {
    row = { shop_id: shopId, product_id: productId, quantity: 0, stock_alert: null }
    db.shopStock.push(row)
  }
  return row
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
  for (const { shopId, product, delta } of changes) {
    if (product.type === 'service') continue
    const row = stockRow(shopId, product.id)
    if (row.quantity + delta < 0) {
      const unit = db.units.find((u) => u.id === product.unit_id)
      throw new MockHttpError(422, `Stock insuffisant : il reste ${formatQty(row.quantity)} ${unit?.short_name ?? ''} de ${product.name}.`, {
        items: [`Stock insuffisant : il reste ${formatQty(row.quantity)} ${unit?.short_name ?? ''} de ${product.name}.`],
      })
    }
  }
  for (const { shopId, product, delta } of changes) {
    if (product.type === 'service' || delta === 0) continue
    stockRow(shopId, product.id).quantity += delta
    db.movements.push({
      id: db.movements.length + 1,
      shop_id: shopId,
      product_id: product.id,
      quantity: delta,
      unit_cost: product.cost,
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
