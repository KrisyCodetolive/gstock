import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCustomer, getCustomerSummary, listCustomers, updateCustomer } from '@/lib/api/customers'
import type { Id, ListParams } from '@/types/api'
import type { CustomerPayload } from '@/types/customers'

const customersKey = ['customers'] as const

export function useCustomers(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [...customersKey, 'list', params],
    queryFn: () => listCustomers(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useCustomerSummary(id: Id | undefined) {
  return useQuery({
    queryKey: [...customersKey, 'summary', id],
    queryFn: () => getCustomerSummary(id!),
    enabled: id !== undefined,
  })
}

export function useSaveCustomer(id?: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CustomerPayload) => (id === undefined ? createCustomer(payload) : updateCustomer(id, payload)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: customersKey }),
  })
}
