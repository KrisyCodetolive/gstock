import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import {
  changePassword,
  deleteAvatar,
  forgotPassword,
  getMe,
  login,
  logout,
  resetPassword,
  updateProfile,
  uploadAvatar,
} from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  Me,
  PasswordChangePayload,
  Permission,
  ProfilePayload,
  ResetPasswordPayload,
} from '@/types/auth'

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

export function useForgotPassword() {
  return useMutation({ mutationFn: (payload: ForgotPasswordPayload) => forgotPassword(payload) })
}

/** Le serveur ferme les sessions ouvertes : on oublie la session locale. */
export function useResetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
    onSuccess: () => queryClient.setQueryData(meQueryKey, null),
  })
}

/** Profil, photo : la réponse est le nouveau GET /me (nom et photo à jour partout). */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProfilePayload) => updateProfile(payload),
    onSuccess: (me) => queryClient.setQueryData(meQueryKey, me),
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: (payload: PasswordChangePayload) => changePassword(payload) })
}

export function useAvatar() {
  const queryClient = useQueryClient()
  const onSuccess = (me: Me) => queryClient.setQueryData(meQueryKey, me)
  return {
    upload: useMutation({ mutationFn: (file: File) => uploadAvatar(file), onSuccess }),
    remove: useMutation({ mutationFn: deleteAvatar, onSuccess }),
  }
}
