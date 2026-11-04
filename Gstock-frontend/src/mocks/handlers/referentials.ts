// Endpoints simulés des référentiels (M05). Pas de DELETE : on désactive.
import { delay, http, HttpResponse } from 'msw'
import type { Permission } from '@/types/auth'
import { db, nextId, persist } from '../db'
import { API, findOr404, handle, normalize, paginate, requirePermission, Validator } from '../http'

interface Row {
  id: number
  name: string
  is_active: boolean
}

interface Definition<T extends Row> {
  path: string
  rows: () => T[]
  /** Lecture : les écrans de vente et de stock en auront besoin plus tard. */
  read: Permission[]
  write: Permission[]
  /** Valide le corps et renvoie les champs propres à ce référentiel. */
  fields: (body: Record<string, unknown>, v: Validator, current?: T) => Omit<T, 'id' | 'name' | 'is_active'>
  toResource?: (row: T) => unknown
  nameMessage: string
}

function crud<T extends Row>(def: Definition<T>) {
  const resource = (row: T) => (def.toResource ? def.toResource(row) : row)

  const save = (body: Record<string, unknown>, current?: T): Omit<T, 'id'> => {
    const v = new Validator()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    v.required(name, 'name', def.nameMessage)
    if (name) {
      const taken = def.rows().some((r) => r.id !== current?.id && normalize(r.name) === normalize(name))
      v.check(!taken, 'name', 'Ce nom existe déjà dans la liste.')
    }
    const fields = def.fields(body, v, current)
    v.done()
    return { ...fields, name, is_active: body.is_active !== false } as Omit<T, 'id'>
  }

  return [
    http.get(`${API}/${def.path}`, ({ request }) =>
      handle(async () => {
        await delay(250)
        requirePermission(...def.read)
        return paginate(request, def.rows().map(resource) as T[], {
          searchIn: (r) => r.name,
          filters: { is_active: (r, value) => String(r.is_active) === value },
        })
      }),
    ),
    http.post(`${API}/${def.path}`, ({ request }) =>
      handle(async () => {
        await delay(350)
        requirePermission(...def.write)
        const row = { id: nextId(def.rows()), ...save((await request.json()) as Record<string, unknown>) } as T
        def.rows().push(row)
        persist()
        return HttpResponse.json({ data: resource(row) }, { status: 201 })
      }),
    ),
    http.put(`${API}/${def.path}/:id`, ({ request, params }) =>
      handle(async () => {
        await delay(350)
        requirePermission(...def.write)
        const row = findOr404(def.rows(), params.id)
        Object.assign(row, save((await request.json()) as Record<string, unknown>, row))
        persist()
        return HttpResponse.json({ data: resource(row) })
      }),
    ),
  ]
}

const PAYMENT_TYPES = ['cash', 'mobile_money', 'card', 'other']

export const referentialsHandlers = [
  ...crud({
    path: 'categories',
    rows: () => db.categories,
    read: ['products.view', 'categories.manage'],
    write: ['categories.manage'],
    nameMessage: 'Donnez un nom à la catégorie.',
    fields: (body) => ({ color: (['peach', 'yellow', 'mint', 'lavender'].includes(String(body.color)) ? body.color : 'lavender') as never }),
    toResource: (row) => ({ ...row, products_count: db.products.filter((p) => p.category_id === row.id).length }),
  }),
  ...crud({
    path: 'units',
    rows: () => db.units,
    read: ['products.view', 'units.manage'],
    write: ['units.manage'],
    nameMessage: "Donnez un nom à l'unité.",
    fields: (body, v, current) => {
      v.required(body.short_name, 'short_name', 'Donnez une abréviation, par exemple « ctn ».')
      const baseId = body.base_unit_id === null || body.base_unit_id === undefined ? null : Number(body.base_unit_id)
      if (baseId === null) return { short_name: String(body.short_name ?? '').trim(), base_unit_id: null, operator: null, operator_value: null }
      // Une unité dérivée se rattache à une unité de base, jamais à une autre dérivée (§7.3).
      const base = db.units.find((u) => u.id === baseId)
      v.check(Boolean(base) && base!.base_unit_id === null && baseId !== current?.id, 'base_unit_id', 'Choisissez une unité de base.')
      v.check(body.operator === '*' || body.operator === '/', 'operator', 'Choisissez comment les deux unités se comparent.')
      const value = Number(body.operator_value)
      v.check(Number.isFinite(value) && value > 0, 'operator_value', 'Saisissez un nombre supérieur à 0.')
      if (current) {
        const isBaseOfOthers = db.units.some((u) => u.base_unit_id === current.id)
        v.check(!isBaseOfOthers, 'base_unit_id', "D'autres unités dépendent de celle-ci : elle doit rester une unité de base.")
      }
      return {
        short_name: String(body.short_name ?? '').trim(),
        base_unit_id: baseId,
        operator: body.operator as '*' | '/',
        operator_value: String(value),
      }
    },
    toResource: (row) => ({ ...row, products_count: db.products.filter((p) => p.unit_id === row.id).length }),
  }),
  ...crud({
    path: 'payment-methods',
    rows: () => db.paymentMethods,
    read: ['sales.create', 'repayments.create', 'expenses.create', 'settings.manage'],
    write: ['settings.manage'],
    nameMessage: 'Donnez un nom au mode de paiement.',
    fields: (body, v) => {
      v.check(PAYMENT_TYPES.includes(String(body.type)), 'type', 'Choisissez le type de paiement.')
      // GeniusPay ne concerne que le Mobile Money et la carte (ADR-003).
      const online = body.type === 'mobile_money' || body.type === 'card'
      return { type: body.type as never, uses_geniuspay: online && body.uses_geniuspay === true }
    },
  }),
  ...crud({
    path: 'expense-categories',
    rows: () => db.expenseCategories,
    read: ['expenses.view', 'settings.manage'],
    write: ['settings.manage'],
    nameMessage: 'Donnez un nom à la catégorie de dépenses.',
    fields: () => ({}),
  }),
  ...crud({
    path: 'brands',
    rows: () => db.brands,
    read: ['products.view', 'settings.manage'],
    write: ['settings.manage'],
    nameMessage: 'Donnez un nom à la marque.',
    fields: () => ({}),
  }),
]
