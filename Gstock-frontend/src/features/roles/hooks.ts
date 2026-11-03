import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRole, deleteRole, getRole, listPermissions, listRoles, updateRole } from '@/lib/api/roles'
import type { Id, ListParams } from '@/types/api'
import type { RolePayload } from '@/types/users'
import { meQueryKey } from '@/features/auth/hooks'

const rolesKey = ['roles'] as const

export function useRoles(params: ListParams = {}) {
  return useQuery({
    queryKey: [...rolesKey, 'list', params],
    queryFn: () => listRoles(params),
    placeholderData: keepPreviousData,
  })
}

export function useRole(id: Id | undefined) {
  return useQuery({ queryKey: [...rolesKey, 'detail', id], queryFn: () => getRole(id!), enabled: id !== undefined })
}

/** La liste ne change jamais (ADR-014) : on la garde en cache. */
export function usePermissions() {
  return useQuery({ queryKey: ['permissions'], queryFn: listPermissions, staleTime: Infinity })
}

export function useSaveRole(id?: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: RolePayload) => (id === undefined ? createRole(payload) : updateRole(id, payload)),
    onSuccess: (role) => {
      queryClient.setQueryData([...rolesKey, 'detail', role.id], role)
      void queryClient.invalidateQueries({ queryKey: [...rolesKey, 'list'] })
      // Mes propres permissions peuvent avoir changé.
      void queryClient.invalidateQueries({ queryKey: meQueryKey })
    },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...rolesKey, 'list'] }),
  })
}
