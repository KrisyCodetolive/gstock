import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, getUser, listUsers, setUserShops, setUserStatus, updateUser } from '@/lib/api/users'
import type { Id, ListParams } from '@/types/api'
import type { UserPayload } from '@/types/users'

const usersKey = ['users'] as const

export function useUsers(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [...usersKey, 'list', params],
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useUser(id: Id | undefined) {
  return useQuery({ queryKey: [...usersKey, 'detail', id], queryFn: () => getUser(id!), enabled: id !== undefined })
}

/** Les compteurs des boutiques et des rôles dépendent des utilisateurs. */
function useInvalidateRelated() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: [...usersKey, 'list'] })
    void queryClient.invalidateQueries({ queryKey: ['roles'] })
    void queryClient.invalidateQueries({ queryKey: ['shops'] })
  }
}

/**
 * Enregistre le profil puis les affectations aux boutiques (deux endpoints, M04).
 * Les affectations ne sont envoyées que si elles ont changé.
 */
export function useSaveUser(id?: Id) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateRelated()
  return useMutation({
    mutationFn: async ({ payload, shopIds, shopsChanged }: { payload: UserPayload; shopIds: Id[]; shopsChanged: boolean }) => {
      const user = id === undefined ? await createUser(payload) : await updateUser(id, payload)
      return id === undefined || shopsChanged ? setUserShops(user.id, shopIds) : user
    },
    onSuccess: (user) => {
      queryClient.setQueryData([...usersKey, 'detail', user.id], user)
      invalidate()
    },
  })
}

export function useSetUserStatus(id: Id) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateRelated()
  return useMutation({
    mutationFn: (isActive: boolean) => setUserStatus(id, isActive),
    onSuccess: (user) => {
      queryClient.setQueryData([...usersKey, 'detail', user.id], user)
      invalidate()
    },
  })
}
