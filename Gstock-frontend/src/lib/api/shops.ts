// Endpoints des boutiques (M03). Pas de suppression : on désactive.
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type { Shop, ShopPayload } from '@/types/settings'
import { http } from './client'

export function listShops(params: ListParams = {}): Promise<Paginated<Shop>> {
  return http.get<Paginated<Shop>>('/shops', params)
}

export async function getShop(id: Id): Promise<Shop> {
  return (await http.get<Resource<Shop>>(`/shops/${id}`)).data
}

export async function createShop(payload: ShopPayload): Promise<Shop> {
  return (await http.post<Resource<Shop>>('/shops', payload)).data
}

export async function updateShop(id: Id, payload: ShopPayload): Promise<Shop> {
  return (await http.put<Resource<Shop>>(`/shops/${id}`, payload)).data
}
