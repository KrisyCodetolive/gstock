import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getPaymentSettings,
  getSettings,
  testPaymentSettings,
  updatePaymentSettings,
  updateSettings,
} from '@/lib/api/settings'
import { meQueryKey } from '@/features/auth/hooks'

const settingsKey = ['settings'] as const
const paymentKey = ['settings', 'payment'] as const

export function useSettings(enabled = true) {
  return useQuery({ queryKey: settingsKey, queryFn: getSettings, enabled })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKey, data)
      // Le nom de l'espace est aussi dans la session (barre latérale).
      void queryClient.invalidateQueries({ queryKey: meQueryKey })
    },
  })
}

export function usePaymentSettings() {
  return useQuery({ queryKey: paymentKey, queryFn: getPaymentSettings })
}

export function useUpdatePaymentSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePaymentSettings,
    onSuccess: (data) => queryClient.setQueryData(paymentKey, data),
  })
}

export function useTestPaymentSettings() {
  return useMutation({ mutationFn: testPaymentSettings })
}
