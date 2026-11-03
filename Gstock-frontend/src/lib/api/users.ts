// Endpoints des utilisateurs (M04).
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type { UserDetail, UserPayload } from '@/types/users'
import { http } from './client'

export function listUsers(params: ListParams = {}): Promise<Paginated<UserDetail>> {
  return http.get<Paginated<UserDetail>>('/users', params)
}

export async function getUser(id: Id): Promise<UserDetail> {
  return (await http.get<Resource<UserDetail>>(`/users/${id}`)).data
}

export async function createUser(payload: UserPayload): Promise<UserDetail> {
  return (await http.post<Resource<UserDetail>>('/users', payload)).data
}

export async function updateUser(id: Id, payload: UserPayload): Promise<UserDetail> {
  return (await http.put<Resource<UserDetail>>(`/users/${id}`, payload)).data
}

/** Activation ou désactivation : un utilisateur inactif ne peut plus se connecter. */
export async function setUserStatus(id: Id, is_active: boolean): Promise<UserDetail> {
  return (await http.patch<Resource<UserDetail>>(`/users/${id}/status`, { is_active })).data
}

/** Boutiques auxquelles l'utilisateur est affecté. */
export async function setUserShops(id: Id, shop_ids: Id[]): Promise<UserDetail> {
  return (await http.put<Resource<UserDetail>>(`/users/${id}/shops`, { shop_ids })).data
}
