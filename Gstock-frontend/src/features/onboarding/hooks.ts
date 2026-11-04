import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meQueryKey } from '@/features/auth/hooks'
import {
  checkout,
  checkSlug,
  dismissOnboarding,
  getOnboarding,
  getSubscription,
  listInvoices,
  listPlans,
  register,
  skipOnboardingStep,
  tokenLogin,
} from '@/lib/api/subscription'
import type { ListParams } from '@/types/api'
import type { OnboardingStepId } from '@/types/subscription'

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: listPlans, staleTime: 10 * 60_000 })
}

/** Disponibilité de l'adresse, vérifiée pendant la saisie. */
export function useSlugCheck(slug: string) {
  return useQuery({
    queryKey: ['slug-check', slug],
    queryFn: ({ signal }) => checkSlug(slug, signal),
    enabled: slug.length >= 3,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useRegister() {
  return useMutation({ mutationFn: register })
}

export function useTokenLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: tokenLogin,
    onSuccess: (me) => queryClient.setQueryData(meQueryKey, me),
  })
}

/** Relit l'état toutes les 2 s tant qu'un paiement attend la confirmation de GeniusPay. */
export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    refetchInterval: (query) => (query.state.data?.pending_invoice ? 2000 : false),
  })
}

export function useInvoices(params: ListParams) {
  return useQuery({ queryKey: ['subscription', 'invoices', params], queryFn: () => listInvoices(params), placeholderData: keepPreviousData })
}

export function useCheckout() {
  return useMutation({ mutationFn: checkout })
}

export function useOnboarding(enabled = true) {
  return useQuery({ queryKey: ['onboarding'], queryFn: getOnboarding, enabled })
}

export function useSkipOnboardingStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (step: OnboardingStepId) => skipOnboardingStep(step),
    onSuccess: (data) => queryClient.setQueryData(['onboarding'], data),
  })
}

export function useDismissOnboarding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: dismissOnboarding,
    onSuccess: (data) => queryClient.setQueryData(['onboarding'], data),
  })
}
