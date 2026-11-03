import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { getMe, login, logout } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import type { LoginPayload, Me, Permission } from '@/types/auth'

export const meQueryKey = ['me'] as const

/** Session courante : null si personne n'est connecté. */
export function useMe() {
  return useQuery<Me | null>({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        return await getMe()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 5 * 60_000,
  })
}

/** Session courante, à utiliser sous la garde RequireAuth (jamais null). */
export function useSession(): Me {
  const { data } = useMe()
  if (!data) throw new Error('useSession appelé hors de RequireAuth')
  return data
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (me) => queryClient.setQueryData(meQueryKey, me),
  })
}

/**
 * Déconnexion volontaire : on va sur l'écran de connexion sans mémoriser la page,
 * pour que la personne suivante arrive sur l'accueil.
 */
export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // D'abord quitter les pages protégées (flushSync : navigation appliquée tout de suite,
      // pas en transition), sinon leur garde mémoriserait la page en cours.
      void navigate('/connexion', { replace: true, state: { loggedOut: true }, flushSync: true })
      queryClient.setQueryData(meQueryKey, null)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== meQueryKey[0] })
    },
  })
}

/** Vérifie une permission. L'interface masque, le serveur refuse (§6.2). */
export function useCan() {
  const me = useSession()
  return (permission: Permission | readonly Permission[]) => {
    const list: readonly Permission[] = typeof permission === 'string' ? [permission] : permission
    return list.some((p) => me.permissions.includes(p))
  }
}
