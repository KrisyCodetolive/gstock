// Endpoints des rôles et des permissions (M04, ADR-014).
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type { PermissionDefinition, RoleDetail, RolePayload } from '@/types/users'
import { http } from './client'

export function listRoles(params: ListParams = {}): Promise<Paginated<RoleDetail>> {
  return http.get<Paginated<RoleDetail>>('/roles', params)
}

export async function getRole(id: Id): Promise<RoleDetail> {
  return (await http.get<Resource<RoleDetail>>(`/roles/${id}`)).data
}

export async function createRole(payload: RolePayload): Promise<RoleDetail> {
  return (await http.post<Resource<RoleDetail>>('/roles', payload)).data
}

export async function updateRole(id: Id, payload: RolePayload): Promise<RoleDetail> {
  return (await http.put<Resource<RoleDetail>>(`/roles/${id}`, payload)).data
}

/** Refusé sur Owner et sur un rôle attribué à au moins un utilisateur. */
export async function deleteRole(id: Id): Promise<void> {
  await http.delete<void>(`/roles/${id}`)
}

/** Liste fixe, en lecture seule. */
export async function listPermissions(): Promise<PermissionDefinition[]> {
  return (await http.get<Resource<PermissionDefinition[]>>('/permissions')).data
}
