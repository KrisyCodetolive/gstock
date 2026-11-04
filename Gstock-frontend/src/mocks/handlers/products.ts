// Endpoints simulés du module M06 : produits.
import { delay, http, HttpResponse } from 'msw'
import type { Product, ProductCreatePayload, ProductSearchResult, ProductShopStock, StockState } from '@/types/catalog'
import type { MockProduct } from '../data/products'
import { db, nextId, persist } from '../db'
import { API, findOr404, handle, MockHttpError, normalize, nullable, paginate, permissionsOf, readImage, requirePermission, requireUser, Validator } from '../http'
import { alertOf, applyStockChanges, itemName, money, productQuantity, qty, requireShopAccess, stockRow, stockState } from '../stock'
import { currentPlan } from '../platform'
import { unitFamily, unitOption } from '../units'

function refs(p: MockProduct) {
  const category = db.categories.find((c) => c.id === p.category_id)
  const brand = db.brands.find((b) => b.id === p.brand_id)
  const unit = db.units.find((u) => u.id === p.unit_id) ?? db.units[0]!
  return {
    category: category ? { id: category.id, name: category.name, color: category.color } : null,
    brand: brand ? { id: brand.id, name: brand.name } : null,
    unit: { id: unit.id, name: unit.name, short_name: unit.short_name },
    units: unitFamily(unit.id).map(unitOption),
    purchase_unit: purchaseUnitOf(p),
  }
}

function purchaseUnitOf(p: MockProduct) {
  const unit = p.purchase_unit_id ? db.units.find((u) => u.id === p.purchase_unit_id && u.base_unit_id === p.unit_id) : undefined
  return unit ? unitOption(unit) : null
}

/** Stock d'un article (produit simple ou variante) dans une boutique. */
function variantLevel(p: MockProduct, shopId: number, variantId: number | null) {
  const quantity = stockRow(shopId, p.id, variantId).quantity
  const alert = alertOf(p, shopId, variantId)
  return { quantity, alert, state: stockState(quantity, alert) }
}

/** Produit à variantes : le total, en « faible » dès qu'une variante active l'est. */
function level(p: MockProduct, shopId: number | null) {
  if (shopId === null || p.type === 'service') return null
  if (p.type !== 'variable') {
    const l = variantLevel(p, shopId, null)
    return { quantity: qty(l.quantity), stock_alert: l.alert === null ? null : qty(l.alert), state: l.state }
  }
  const levels = (p.variants ?? []).filter((v) => v.is_active).map((v) => variantLevel(p, shopId, v.id))
  const quantity = productQuantity(shopId, p)
  const state = quantity <= 0 ? 'out' : levels.some((l) => l.state !== 'ok') ? 'low' : 'ok'
  return { quantity: qty(quantity), stock_alert: p.stock_alert === null ? null : qty(p.stock_alert), state: state as StockState }
}

/** Plus bas prix des variantes actives : « à partir de ». */
function displayPrice(p: MockProduct) {
  const active = (p.variants ?? []).filter((v) => v.is_active)
  return p.type === 'variable' && active.length ? Math.min(...active.map((v) => v.price)) : p.price
}

export function productResource(p: MockProduct, shopId: number | null = null): Product {
  return {
    id: p.id,
    type: p.type,
    name: p.name,
    code: p.code,
    barcode: p.barcode,
    ...refs(p),
    cost: money(p.cost),
    price: money(displayPrice(p))!,
    tax_rate: p.tax_rate === null ? null : p.tax_rate.toFixed(2),
    stock_alert: p.stock_alert === null ? null : qty(p.stock_alert),
    image_url: p.image_url,
    is_active: p.is_active,
    stock: level(p, shopId),
    variants: (p.variants ?? []).map((v) => ({ id: v.id, name: v.name, code: v.code, barcode: v.barcode, cost: money(v.cost), price: money(v.price)!, is_active: v.is_active })),
  }
}

const num = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function validate(body: Partial<ProductCreatePayload>, current?: MockProduct) {
  const v = new Validator()
  v.required(body.name, 'name', 'Donnez un nom au produit.')
  const type = body.type ?? 'simple'
  // Produit à variantes : le prix est celui de chaque variante.
  const price = type === 'variable' ? 0 : num(body.price)
  v.check(price !== null && price >= 0 && !Number.isNaN(price), 'price', 'Saisissez le prix de vente.')
  const cost = num(body.cost)
  v.check(cost === null || (!Number.isNaN(cost) && cost >= 0), 'cost', 'Le prix d’achat doit être un nombre positif.')
  const alert = num(body.stock_alert)
  v.check(alert === null || (!Number.isNaN(alert) && alert >= 0), 'stock_alert', 'Le seuil doit être un nombre positif.')
  v.check(['simple', 'service', 'variable'].includes(type), 'type', 'Choisissez le type du produit.')
  // Le stock d'un produit à variantes est tenu par variante : le type ne change plus après la création.
  if (current && current.type !== type && (current.type === 'variable' || type === 'variable')) {
    v.add('type', current.type === 'variable' ? 'Un produit à variantes le reste : désactivez-le et créez-en un autre.' : 'Ce produit ne peut pas devenir un produit à variantes : créez-en un nouveau.')
  }
  const variants = type === 'variable' ? validateVariants(body.variants, current, v) : []

  const code = nullable(body.code)
  if (code) v.check(!db.products.some((p) => p.id !== current?.id && normalize(p.code) === normalize(code)), 'code', 'Ce code est déjà utilisé par un autre produit.')
  const barcode = type === 'variable' ? null : nullable(body.barcode)
  if (barcode) v.check(!barcodeTaken(barcode, current?.id), 'barcode', 'Ce code-barres est déjà utilisé par un autre produit.')
  if (body.category_id) v.check(db.categories.some((c) => c.id === Number(body.category_id)), 'category_id', 'Cette catégorie n’existe pas.')
  if (body.unit_id) v.check(db.units.some((u) => u.id === Number(body.unit_id)), 'unit_id', 'Cette unité n’existe pas.')
  const unitId = body.unit_id ? Number(body.unit_id) : (db.units.find((u) => u.base_unit_id === null)?.id ?? 1)
  // Unité d'achat : dérivée de l'unité de base du produit (Carton = Unité × 12).
  const purchaseUnitId = body.purchase_unit_id ? Number(body.purchase_unit_id) : null
  if (purchaseUnitId !== null) {
    v.check(
      db.units.some((u) => u.id === purchaseUnitId && u.base_unit_id === unitId),
      'purchase_unit_id',
      "L'unité d'achat doit être une unité dérivée de l'unité du produit (par exemple Carton pour Unité).",
    )
  }

  const initial = num(body.initial_quantity)
  if (!current) v.check(initial === null || (!Number.isNaN(initial) && initial >= 0), 'initial_quantity', 'La quantité doit être un nombre positif.')
  v.done()

  return {
    type,
    name: body.name!.trim(),
    code,
    barcode,
    category_id: body.category_id ? Number(body.category_id) : null,
    brand_id: body.brand_id ? Number(body.brand_id) : null,
    unit_id: unitId,
    purchase_unit_id: type === 'service' ? null : purchaseUnitId,
    cost,
    price: price!,
    tax_rate: num(body.tax_rate),
    stock_alert: type === 'service' ? null : alert,
    is_active: body.is_active !== false,
    initial: type === 'simple' ? initial : null,
    variants,
  }
}

/** Un code-barres est unique dans l'espace, produits et variantes confondus. */
function barcodeTaken(barcode: string, exceptProductId?: number) {
  return db.products.some((p) => p.id !== exceptProductId && (p.barcode === barcode || (p.variants ?? []).some((x) => x.barcode === barcode)))
}

type VariantInput = { id: number | null; name: string; barcode: string | null; cost: number | null; price: number; is_active: boolean }

/**
 * Variantes envoyées : noms uniques, prix obligatoire, au moins une active.
 * Une variante existante absente de la liste est gardée telle quelle (on ne supprime pas, on désactive).
 */
function validateVariants(input: ProductCreatePayload['variants'], current: MockProduct | undefined, v: Validator): VariantInput[] {
  const rows = (input ?? []).map((x) => ({
    id: x.id ? Number(x.id) : null,
    name: String(x.name ?? '').trim(),
    barcode: nullable(x.barcode),
    cost: num(x.cost),
    price: num(x.price),
    is_active: x.is_active !== false,
  }))
  const kept = (current?.variants ?? []).filter((e) => !rows.some((x) => x.id === e.id)).map((e) => ({ ...e }))
  const all = [...rows, ...kept]
  if (!all.some((x) => x.is_active)) v.add('variants', 'Ajoutez au moins une variante active (par exemple une taille ou un parfum).')
  for (const x of rows) {
    if (x.id !== null && !current?.variants?.some((e) => e.id === x.id)) v.add('variants', 'Une des variantes n’existe pas.')
    if (!x.name) v.add('variants', 'Donnez un nom à chaque variante.')
    if (x.price === null || Number.isNaN(x.price) || x.price < 0) v.add('variants', `Saisissez le prix de la variante ${x.name || 'sans nom'}.`)
    if (x.cost !== null && (Number.isNaN(x.cost) || x.cost < 0)) v.add('variants', `Le prix d’achat de ${x.name || 'la variante'} doit être un nombre positif.`)
  }
  const names = all.map((x) => normalize(x.name)).filter(Boolean)
  if (new Set(names).size !== names.length) v.add('variants', 'Deux variantes portent le même nom.')
  const codes = all.map((x) => x.barcode).filter(Boolean)
  if (new Set(codes).size !== codes.length) v.add('variants', 'Deux variantes ont le même code-barres.')
  for (const x of rows) if (x.barcode && barcodeTaken(x.barcode, current?.id)) v.add('variants', `Le code-barres de ${x.name} est déjà utilisé par un autre produit.`)
  return rows.map((x) => ({ ...x, price: x.price ?? 0 }))
}

/** Enregistre les variantes : nouvelles créées (code P-0061-n, stock à 0 partout), autres mises à jour. */
function saveVariants(product: MockProduct, rows: VariantInput[]) {
  if (product.type !== 'variable') return
  product.variants ??= []
  let nextId = Math.max(0, ...db.products.flatMap((p) => (p.variants ?? []).map((x) => x.id)))
  for (const row of rows) {
    const existing = row.id !== null ? product.variants.find((x) => x.id === row.id) : undefined
    if (existing) {
      Object.assign(existing, { name: row.name, barcode: row.barcode, cost: row.cost, price: row.price, is_active: row.is_active })
    } else {
      const variant = { id: ++nextId, name: row.name, code: `${product.code}-${product.variants.length + 1}`, barcode: row.barcode, cost: row.cost, price: row.price, is_active: row.is_active }
      product.variants.push(variant)
      for (const s of db.shops) stockRow(s.id, product.id, variant.id)
    }
  }
  // Prix « à partir de » du produit, pour les listes et les rapports.
  const active = product.variants.filter((x) => x.is_active)
  if (active.length) product.price = Math.min(...active.map((x) => x.price))
}

/**
 * Articles d'un produit pour les sélecteurs et la caisse : le produit, ou une entrée
 * par variante active (`name` « Produit — Variante », prix et stock de la variante).
 */
export function articlesOf(p: MockProduct, shopId: number): ProductSearchResult[] {
  const r = productResource(p, shopId)
  const base = {
    id: r.id,
    type: r.type,
    code: r.code,
    unit: r.unit,
    purchase_unit_id: r.purchase_unit?.id ?? null,
    units: r.units,
    category: r.category,
    image_url: r.image_url,
  }
  if (p.type !== 'variable') {
    return [{ ...base, variant_id: null, variant_name: null, name: r.name, barcode: r.barcode, price: r.price, cost: r.cost, quantity: r.stock?.quantity ?? null, state: r.stock?.state ?? null }]
  }
  return (p.variants ?? [])
    .filter((v) => v.is_active)
    .map((v) => {
      const l = variantLevel(p, shopId, v.id)
      return { ...base, variant_id: v.id, variant_name: v.name, name: itemName(p, v.id), code: v.code, barcode: v.barcode, price: money(v.price)!, cost: money(v.cost), quantity: qty(l.quantity), state: l.state }
    })
}

export const productsHandlers = [
  http.get(`${API}/products`, ({ request }) =>
    handle(async () => {
      await delay(300)
      const user = requirePermission('products.view')
      const url = new URL(request.url)
      const shopParam = url.searchParams.get('shop_id')
      const shopId = shopParam ? requireShopAccess(user, shopParam).id : null
      const rows = db.products.map((p) => productResource(p, shopId))
      return paginate(request, rows, {
        searchIn: (p) => `${p.name} ${p.code} ${p.barcode ?? ''}`,
        filters: {
          category_id: (p, value) => String(p.category?.id ?? '') === value,
          is_active: (p, value) => String(p.is_active) === value,
          state: (p, value) => p.stock?.state === value,
        },
      })
    }),
  ),

  http.get(`${API}/products/:id`, ({ request, params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('products.view')
      const shopParam = new URL(request.url).searchParams.get('shop_id')
      const shopId = shopParam ? requireShopAccess(user, shopParam).id : null
      return HttpResponse.json({ data: productResource(findOr404(db.products, params.id), shopId) })
    }),
  ),

  // Stock de chaque boutique à laquelle l'utilisateur a accès.
  http.get(`${API}/products/:id/stock`, ({ params }) =>
    handle(async () => {
      await delay(250)
      const user = requirePermission('products.view')
      const product = findOr404(db.products, params.id)
      const visible = db.shops.filter((s) => user.shop_ids.includes(s.id) || db.roles.find((r) => r.id === user.role_id)?.is_owner)
      const data: ProductShopStock[] =
        product.type === 'service'
          ? []
          : visible.map((s) => {
              const total = level(product, s.id)!
              return {
                shop: { id: s.id, name: s.name, is_active: s.is_active },
                quantity: total.quantity,
                stock_alert: total.stock_alert,
                state: total.state,
                variants: (product.variants ?? []).map((v) => {
                  const l = variantLevel(product, s.id, v.id)
                  return { id: v.id, name: v.name, quantity: qty(l.quantity), state: l.state }
                }),
              }
            })
      return HttpResponse.json({ data })
    }),
  ),

  // Recherche compacte pour les sélecteurs de produits (stock, caisse) : nom, code ou code-barres.
  http.get(`${API}/shops/:shopId/products/search`, ({ request, params }) =>
    handle(async () => {
      await delay(200)
      const user = requireUser()
      const shop = requireShopAccess(user, params.shopId)
      const q = normalize(new URL(request.url).searchParams.get('q') ?? '')
      const withServices = new URL(request.url).searchParams.get('services') === 'true'
      const active = db.products.filter((p) => p.is_active && (withServices || p.type !== 'service'))
      const articles = active.flatMap((p) => articlesOf(p, shop.id))
      // Un code-barres exact (produit ou variante) ne renvoie que son article (douchette, caméra).
      const exact = articles.filter((a) => a.barcode && normalize(a.barcode) === q)
      const data: ProductSearchResult[] = (
        exact.length ? exact : articles.filter((a) => normalize(`${a.name} ${a.code} ${a.barcode ?? ''}`).includes(q))
      ).slice(0, 20)
      return HttpResponse.json({ data })
    }),
  ),

  http.post(`${API}/products`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('products.create')
      const body = (await request.json()) as Partial<ProductCreatePayload>
      const { initial, variants, ...fields } = validate(body)
      // Limite du plan (M00) : les produits désactivés ne comptent pas.
      const max = currentPlan().max_products
      if (db.products.filter((p) => p.is_active).length >= max) {
        throw new MockHttpError(422, `Votre abonnement permet ${max} produits au maximum.`, {
          name: [`Votre abonnement permet ${max} produits au maximum. Désactivez des produits que vous ne vendez plus ou passez à une formule supérieure.`],
        })
      }
      const id = nextId(db.products)
      const product: MockProduct = { id, ...fields, code: fields.code ?? `P-${String(id).padStart(4, '0')}`, image_url: null }

      // Quantité initiale : demande l'accès à la boutique et le droit d'ajouter du stock.
      let shopId: number | null = null
      if (initial && initial > 0) {
        shopId = requireShopAccess(user, body.shop_id).id
        if (!permissionsOf(user).includes('stock.entry')) {
          return HttpResponse.json({ message: "Vous n'avez pas le droit d'ajouter du stock." }, { status: 403 })
        }
      }
      db.products.push(product)
      // La création crée une ligne de stock à 0 dans chaque boutique (§7.2), par variante s'il y en a.
      if (product.type === 'simple') for (const s of db.shops) stockRow(s.id, product.id)
      saveVariants(product, variants)
      if (shopId !== null && initial) {
        applyStockChanges([{ shopId, product, delta: initial }], {
          source_type: 'opening',
          source_id: null,
          reference: null,
          reason: 'Stock initial',
          user_id: user.id,
          occurred_at: new Date().toISOString(),
        })
      }
      persist()
      return HttpResponse.json({ data: productResource(product, shopId) }, { status: 201 })
    }),
  ),

  http.put(`${API}/products/:id`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const body = (await request.json()) as Partial<ProductCreatePayload>
      const product = findOr404(db.products, params.id)
      // Désactiver demande products.disable ; le reste, products.update.
      const disabling = body.is_active === false && product.is_active
      const user = requirePermission(...(disabling ? (['products.disable'] as const) : (['products.update'] as const)))
      const { initial: _ignored, variants, ...fields } = validate(body, product)
      // Un produit qui a du stock ne devient pas un service.
      if (fields.type === 'service' && product.type !== 'service' && db.shopStock.some((s) => s.product_id === product.id && s.quantity > 0)) {
        return HttpResponse.json(
          { message: 'Les informations saisies ne sont pas valides.', errors: { type: ['Ce produit a encore du stock : il ne peut pas devenir un service.'] } },
          { status: 422 },
        )
      }
      Object.assign(product, { ...fields, code: fields.code ?? product.code })
      saveVariants(product, variants)
      persist()
      const shopParam = new URL(request.url).searchParams.get('shop_id')
      return HttpResponse.json({ data: productResource(product, shopParam ? requireShopAccess(user, shopParam).id : null) })
    }),
  ),

  // Photo du produit (multipart `image`), déjà réduite par l'application.
  http.post(`${API}/products/:id/image`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      requirePermission('products.update', 'products.create')
      const product = findOr404(db.products, params.id)
      product.image_url = await readImage(request, 'image')
      persist()
      return HttpResponse.json({ data: productResource(product) })
    }),
  ),

  http.delete(`${API}/products/:id/image`, ({ params }) =>
    handle(async () => {
      await delay(200)
      requirePermission('products.update')
      const product = findOr404(db.products, params.id)
      product.image_url = null
      persist()
      return HttpResponse.json({ data: productResource(product) })
    }),
  ),
]
