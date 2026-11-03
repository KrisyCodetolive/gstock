// Endpoints des référentiels (M05). Un élément utilisé se désactive (is_active),
// il ne se supprime pas.
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type {
  Brand,
  BrandPayload,
  Category,
  CategoryPayload,
  ExpenseCategory,
  ExpenseCategoryPayload,
  PaymentMethod,
  PaymentMethodPayload,
  Unit,
  UnitPayload,
} from '@/types/referentials'
import { http } from './client'

/** Chemin d'API de chaque référentiel, avec ses types. */
export interface ReferentialTypes {
  categories: { item: Category; payload: CategoryPayload }
  units: { item: Unit; payload: UnitPayload }
  'payment-methods': { item: PaymentMethod; payload: PaymentMethodPayload }
  'expense-categories': { item: ExpenseCategory; payload: ExpenseCategoryPayload }
  brands: { item: Brand; payload: BrandPayload }
}

export type ReferentialResource = keyof ReferentialTypes
export type ReferentialItem<R extends ReferentialResource> = ReferentialTypes[R]['item']
export type ReferentialPayload<R extends ReferentialResource> = ReferentialTypes[R]['payload']

export function listReferential<R extends ReferentialResource>(resource: R, params: ListParams = {}) {
  return http.get<Paginated<ReferentialItem<R>>>(`/${resource}`, params)
}

export async function createReferential<R extends ReferentialResource>(resource: R, payload: ReferentialPayload<R>) {
  return (await http.post<Resource<ReferentialItem<R>>>(`/${resource}`, payload)).data
}

export async function updateReferential<R extends ReferentialResource>(resource: R, id: Id, payload: ReferentialPayload<R>) {
  return (await http.put<Resource<ReferentialItem<R>>>(`/${resource}/${id}`, payload)).data
}
