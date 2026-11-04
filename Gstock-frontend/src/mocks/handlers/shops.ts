// Endpoints simulés des boutiques (M03), mêmes règles que le serveur.
import { delay, http, HttpResponse } from 'msw'
import type { Shop, ShopPayload } from '@/types/settings'
import { db, nextId, persist } from '../db'
import { stockRow } from '../stock'
import { API, findOr404, handle, normalize, nullable, paginate, requirePermission, Validator } from '../http'
import { currentPlan } from '../platform'

type ShopRow = (typeof db.shops)[number]

/** Personnes qui ont accès à la boutique : les propriétaires et les affectés. */
export function shopUsersCount(shopId: number): number {
  const ownerRoles = db.roles.filter((r) => r.is_owner).map((r) => r.id)
  return db.users.filter((u) => ownerRoles.includes(u.role_id) || u.shop_ids.includes(shopId)).length
}

const toResource = (shop: ShopRow): Shop => ({ ...shop, users_count: shopUsersCount(shop.id) })

function validate(body: Partial<ShopPayload>, current?: ShopRow) {
  const v = new Validator()
  v.required(body.name, 'name', 'Donnez un nom à la boutique.')
  v.required(body.city, 'city', 'Indiquez la ville de la boutique.')
  if (body.name) {
    const taken = db.shops.some((s) => s.id !== current?.id && normalize(s.name) === normalize(body.name!))
    v.check(!taken, 'name', 'Une autre boutique porte déjà ce nom.')
  }
  // Une boutique désactivée n'est plus comptée dans la limite du plan.
  const activeOthers = db.shops.filter((s) => s.is_active && s.id !== current?.id).length
  if (body.is_active !== false && (!current || !current.is_active) && activeOthers >= currentPlan().max_shops) {
    v.add('name', `Votre abonnement permet ${currentPlan().max_shops} boutiques ouvertes au maximum.`)
  }
  if (current?.is_active && body.is_active === false && activeOthers === 0) {
    v.add('is_active', 'Gardez au moins une boutique ouverte.')
  }
  v.done()
}

function fromBody(body: Partial<ShopPayload>): Omit<ShopRow, 'id'> {
  return {
    name: body.name!.trim(),
    city: body.city!.trim(),
    district: nullable(body.district),
    address: nullable(body.address),
    phone: nullable(body.phone),
    receipt_note: nullable(body.receipt_note),
    receipt_show_customer: body.receipt_show_customer ?? true,
    receipt_show_phone: body.receipt_show_phone ?? true,
    auto_print_receipt: body.auto_print_receipt ?? false,
    default_customer_id: body.default_customer_id ?? null,
    is_active: body.is_active ?? true,
  }
}

export const shopsHandlers = [
  http.get(`${API}/shops`, ({ request }) =>
    handle(async () => {
      await delay(300)
      requirePermission('shops.manage', 'users.manage')
      return paginate(request, db.shops.map(toResource), {
        searchIn: (s) => `${s.name} ${s.city} ${s.district ?? ''}`,
        filters: { is_active: (s, v) => String(s.is_active) === v },
      })
    }),
  ),

  http.get(`${API}/shops/:id`, ({ params }) =>
    handle(async () => {
      await delay(250)
      requirePermission('shops.manage')
      return HttpResponse.json({ data: toResource(findOr404(db.shops, params.id)) })
    }),
  ),

  http.post(`${API}/shops`, ({ request }) =>
    handle(async () => {
      await delay(400)
      requirePermission('shops.manage')
      const body = (await request.json()) as Partial<ShopPayload>
      validate(body)
      const shop: ShopRow = { id: nextId(db.shops), ...fromBody(body) }
      db.shops.push(shop)
      // La création d'une boutique crée une ligne de stock à 0 pour chaque produit (§7.2).
      for (const p of db.products) if (p.type !== 'service') stockRow(shop.id, p.id)
      persist()
      return HttpResponse.json({ data: toResource(shop) }, { status: 201 })
    }),
  ),

  http.put(`${API}/shops/:id`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      requirePermission('shops.manage')
      const shop = findOr404(db.shops, params.id)
      const body = (await request.json()) as Partial<ShopPayload>
      validate(body, shop)
      Object.assign(shop, fromBody(body))
      persist()
      return HttpResponse.json({ data: toResource(shop) })
    }),
  ),
]
