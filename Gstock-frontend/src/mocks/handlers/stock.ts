// Endpoints simulés du module M07 : stock, mouvements, ajustements (MS-N).
import { delay, http, HttpResponse } from 'msw'
import type { Permission } from '@/types/auth'
import type { Adjustment, AdjustmentPayload, StockItem, StockMovement, StockOverviewItem } from '@/types/stock'
import type { MockAdjustment, MockProduct } from '../data/products'
import { db, nextId, nextReference, persist } from '../db'
import { API, findOr404, handle, isOwner, MockHttpError, paginate, requirePermission, Validator } from '../http'
import { alertOf, applyStockChanges, canSeeAll, money, qty, requireShopAccess, stockRow, stockState, userName } from '../stock'

const stockable = () => db.products.filter((p) => p.type !== 'service')

function productRef(p: MockProduct) {
  const category = db.categories.find((c) => c.id === p.category_id)
  const unit = db.units.find((u) => u.id === p.unit_id) ?? db.units[0]!
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    category: category ? { id: category.id, name: category.name, color: category.color } : null,
    unit: { id: unit.id, name: unit.name, short_name: unit.short_name },
    is_active: p.is_active,
  }
}

function stockItem(p: MockProduct, shopId: number): StockItem {
  const quantity = stockRow(shopId, p.id).quantity
  const alert = alertOf(p, shopId)
  return {
    product: productRef(p),
    quantity: qty(quantity),
    stock_alert: alert === null ? null : qty(alert),
    cost: money(p.cost),
    value: p.cost === null ? null : money(quantity * p.cost),
    state: stockState(quantity, alert),
  }
}

/** Liste filtrée + totaux de la boutique (indépendants de la page). */
async function stockResponse(request: Request, shopId: number, onlyAlerts: boolean) {
  const items = stockable()
    .filter((p) => p.is_active)
    .map((p) => stockItem(p, shopId))
  const summary = {
    products: items.length,
    low: items.filter((i) => i.state === 'low').length,
    out: items.filter((i) => i.state === 'out').length,
    value: money(items.reduce((sum, i) => sum + Number(i.value ?? 0), 0))!,
  }
  const rows = onlyAlerts ? items.filter((i) => i.state !== 'ok') : items
  const page = await paginate(request, rows, {
    searchIn: (i) => `${i.product.name} ${i.product.code}`,
    filters: {
      state: (i, v) => i.state === v,
      category_id: (i, v) => String(i.product.category?.id ?? '') === v,
    },
  }).json()
  return HttpResponse.json({ ...page, summary })
}

function adjustmentResource(a: MockAdjustment): Adjustment {
  return {
    id: a.id,
    reference: a.reference,
    kind: a.kind,
    reason: a.reason,
    status: a.status,
    items: a.items.map((item) => {
      const p = db.products.find((x) => x.id === item.product_id)!
      const ref = productRef(p)
      return {
        product: { id: ref.id, name: ref.name, unit: ref.unit },
        quantity: qty(item.quantity),
        counted_quantity: item.counted_quantity === null ? null : qty(item.counted_quantity),
      }
    }),
    user: userName(a.user_id),
    occurred_at: a.occurred_at,
    cancelled_at: a.cancelled_at,
    cancel_reason: a.cancel_reason,
  }
}

const KIND_PERMISSION: Record<MockAdjustment['kind'], Permission> = {
  entry: 'stock.entry',
  exit: 'stock.exit',
  inventory: 'stock.adjust',
}

const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : Number(String(v).replace(',', '.')))

export const stockHandlers = [
  http.get(`${API}/shops/:shopId/stock`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('stock.view')
      return stockResponse(request, requireShopAccess(user, params.shopId).id, false)
    }),
  ),

  http.get(`${API}/shops/:shopId/stock/alerts`, ({ request, params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('stock.view')
      return stockResponse(request, requireShopAccess(user, params.shopId).id, true)
    }),
  ),

  // Vue « Toutes mes boutiques » (M07) : quantités par boutique et total.
  http.get(`${API}/stock`, ({ request }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('stock.view')
      const shops = db.shops.filter((s) => s.is_active && (isOwner(user) || user.shop_ids.includes(s.id)))
      const rows: StockOverviewItem[] = stockable()
        .filter((p) => p.is_active)
        .map((p) => {
          const perShop = shops.map((s) => {
            const quantity = stockRow(s.id, p.id).quantity
            return { shop_id: s.id, quantity: qty(quantity), state: stockState(quantity, alertOf(p, s.id)) }
          })
          return { product: productRef(p), total: qty(perShop.reduce((sum, s) => sum + Number(s.quantity), 0)), shops: perShop }
        })
      return paginate(request, rows, {
        searchIn: (r) => `${r.product.name} ${r.product.code}`,
        filters: { category_id: (r, v) => String(r.product.category?.id ?? '') === v },
      })
    }),
  ),

  http.get(`${API}/shops/:shopId/stock/movements`, ({ request, params }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('stock.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const productId = new URL(request.url).searchParams.get('product_id')

      // Stock après chaque mouvement : cumul par produit, dans l'ordre chronologique.
      const running = new Map<number, number>()
      const rows: (StockMovement & { user_id: number | null })[] = db.movements
        .filter((m) => m.shop_id === shopId)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id - b.id)
        .map((m) => {
          const balance = (running.get(m.product_id) ?? 0) + m.quantity
          running.set(m.product_id, balance)
          const p = db.products.find((x) => x.id === m.product_id)!
          const ref = productRef(p)
          return {
            id: m.id,
            product: { id: ref.id, name: ref.name, unit: ref.unit },
            quantity: qty(m.quantity),
            balance: qty(balance),
            source_type: m.source_type,
            source_id: m.source_id,
            reference: m.reference,
            reason: m.reason,
            user: userName(m.user_id),
            user_id: m.user_id,
            occurred_at: m.occurred_at,
          }
        })
        .filter((m) => !productId || m.product.id === Number(productId))
        .filter((m) => canSeeAll(user) || m.user_id === user.id)
        .reverse()
      return paginate(
        request,
        rows.map(({ user_id: _u, ...m }) => m),
        { searchIn: (m) => `${m.product.name} ${m.reference ?? ''}`, filters: { source_type: (m, v) => m.source_type === v } },
      )
    }),
  ),

  http.get(`${API}/shops/:shopId/adjustments/:id`, ({ params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('stock.view')
      const shopId = requireShopAccess(user, params.shopId).id
      const adjustment = findOr404(
        db.adjustments.filter((a) => a.shop_id === shopId && (canSeeAll(user) || a.user_id === user.id)),
        params.id,
      )
      return HttpResponse.json({ data: adjustmentResource(adjustment) })
    }),
  ),

  http.post(`${API}/shops/:shopId/adjustments`, ({ request, params }) =>
    handle(async () => {
      await delay(450)
      const body = (await request.json()) as Partial<AdjustmentPayload>
      const kind = body.kind
      if (kind !== 'entry' && kind !== 'exit' && kind !== 'inventory') {
        throw new MockHttpError(422, 'Les informations saisies ne sont pas valides.', { kind: ['Type de mouvement inconnu.'] })
      }
      const user = requirePermission(KIND_PERMISSION[kind])
      const shopId = requireShopAccess(user, params.shopId).id

      // Idempotence hors ligne : un second envoi renvoie l'opération déjà enregistrée (ADR-005).
      const existing = body.offline_uuid && db.adjustments.find((a) => a.offline_uuid === body.offline_uuid)
      if (existing) return HttpResponse.json({ data: adjustmentResource(existing) })

      const v = new Validator()
      v.required(body.reason, 'reason', 'Indiquez le motif du mouvement.')
      const items = body.items ?? []
      v.check(items.length > 0, 'items', 'Ajoutez au moins un produit.')
      const ids = items.map((i) => i.product_id)
      v.check(new Set(ids).size === ids.length, 'items', 'Un même produit apparaît deux fois.')
      const lines = items.map((item) => {
        const product = db.products.find((p) => p.id === Number(item.product_id))
        if (!product || product.type === 'service' || !product.is_active) {
          v.add('items', 'Un des produits ne peut pas être stocké.')
          return null
        }
        const current = stockRow(shopId, product.id).quantity
        if (kind === 'inventory') {
          const counted = num(item.counted_quantity)
          v.check(counted >= 0, 'items', `Saisissez la quantité comptée pour ${product.name}.`)
          return { product, delta: counted - current, quantity: counted - current, counted }
        }
        const quantity = num(item.quantity)
        v.check(quantity > 0, 'items', `Saisissez une quantité supérieure à 0 pour ${product.name}.`)
        return { product, delta: kind === 'entry' ? quantity : -quantity, quantity, counted: null }
      })
      v.done()

      const valid = lines.filter((l): l is NonNullable<typeof l> => l !== null)
      const id = nextId(db.adjustments)
      const occurredAt = new Date().toISOString()
      // On vérifie et on applique d'abord le stock ; la référence n'est consommée qu'en cas de succès.
      const reference = `MS-${db.sequences.MS ?? 1}`
      applyStockChanges(
        valid.map((l) => ({ shopId, product: l.product, delta: l.delta })),
        { source_type: 'adjustment', source_id: id, reference, reason: body.reason!.trim(), user_id: user.id, occurred_at: occurredAt },
      )
      nextReference('MS')
      const adjustment: MockAdjustment = {
        id,
        shop_id: shopId,
        reference,
        kind,
        reason: body.reason!.trim(),
        status: 'completed',
        items: valid.map((l) => ({ product_id: l.product.id, quantity: l.quantity, counted_quantity: l.counted })),
        user_id: user.id,
        occurred_at: occurredAt,
        offline_uuid: body.offline_uuid ?? null,
        cancelled_at: null,
        cancel_reason: null,
      }
      db.adjustments.push(adjustment)
      persist()
      return HttpResponse.json({ data: adjustmentResource(adjustment) }, { status: 201 })
    }),
  ),

  // Annulation : jamais de suppression, motif obligatoire, mouvements inverses (ADR-012).
  http.post(`${API}/shops/:shopId/adjustments/:id/cancel`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('stock.adjust')
      const shopId = requireShopAccess(user, params.shopId).id
      const adjustment = findOr404(db.adjustments.filter((a) => a.shop_id === shopId), params.id)
      if (adjustment.status === 'cancelled') throw new MockHttpError(409, 'Ce mouvement a déjà été annulé.')
      const { reason } = (await request.json()) as { reason?: string }
      const v = new Validator()
      v.required(reason, 'reason', "Indiquez pourquoi vous annulez ce mouvement.")
      v.done()

      // Reprendre une entrée ne doit pas rendre le stock négatif (§7.2).
      applyStockChanges(
        adjustment.items.map((item) => {
          const product = db.products.find((p) => p.id === item.product_id)!
          const applied = adjustment.kind === 'exit' ? -item.quantity : item.quantity
          return { shopId, product, delta: -applied }
        }),
        {
          source_type: 'adjustment_cancel',
          source_id: adjustment.id,
          reference: adjustment.reference,
          reason: `Annulation : ${reason!.trim()}`,
          user_id: user.id,
          occurred_at: new Date().toISOString(),
        },
      )
      Object.assign(adjustment, { status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason!.trim() })
      persist()
      return HttpResponse.json({ data: adjustmentResource(adjustment) })
    }),
  ),
]
