import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adjustCredit,
  cancelCredit,
  cancelRepayment,
  createOpeningBalance,
  createRepayment,
  createRepaymentShareLink,
  getCreditsSummary,
  getCustomerCredits,
  getRepayment,
  getRepaymentReceipt,
  listCredits,
  listDebtors,
  listInstallments,
  listRepayments,
  setInstallments,
} from '@/lib/api/credits'
import type { Id, ListParams } from '@/types/api'
import type { CancelSettlement, InstallmentScheduleItem, RepaymentPayload } from '@/types/credits'

// Les données de crédit d'une boutique portent son id dans la clé de cache (§6.2).
const key = ['credits'] as const

export function useCreditsSummary(shopId: Id | undefined, period: { from?: string; to?: string }) {
  return useQuery({
    queryKey: [...key, shopId, 'summary', period],
    queryFn: () => getCreditsSummary(shopId!, period),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useDebtors(shopId: Id | undefined, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [...key, shopId, 'debtors', params],
    queryFn: () => listDebtors(shopId!, params),
    enabled: enabled && shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useCreditList(shopId: Id | undefined, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [...key, shopId, 'list', params],
    queryFn: () => listCredits(shopId!, params),
    enabled: enabled && shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useRepayments(shopId: Id | undefined, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [...key, shopId, 'repayments', params],
    queryFn: () => listRepayments(shopId!, params),
    enabled: enabled && shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useInstallments(shopId: Id | undefined, status: 'overdue' | 'upcoming', enabled = true) {
  return useQuery({
    queryKey: [...key, shopId, 'installments', status],
    queryFn: () => listInstallments(shopId!, status, { per_page: 100 }),
    enabled: enabled && shopId !== undefined,
  })
}

export function useCustomerCredits(customerId: Id | undefined) {
  return useQuery({
    queryKey: [...key, 'customer', customerId],
    queryFn: () => getCustomerCredits(customerId!),
    enabled: customerId !== undefined,
  })
}

export function useRepayment(shopId: Id | undefined, id: Id) {
  return useQuery({
    queryKey: [...key, shopId, 'repayment', id],
    queryFn: () => getRepayment(shopId!, id),
    enabled: shopId !== undefined,
    // Paiement GeniusPay en attente : on suit sa confirmation.
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 2000 : false),
  })
}

export function useRepaymentReceipt(shopId: Id | undefined, id: Id) {
  return useQuery({ queryKey: [...key, shopId, 'receipt', id], queryFn: () => getRepaymentReceipt(shopId!, id), enabled: shopId !== undefined })
}

/** Toute opération de crédit change les soldes : crédits, clients et ventes sont rafraîchis. */
function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    for (const k of ['credits', 'customers', 'sales']) void queryClient.invalidateQueries({ queryKey: [k] })
  }
}

export function useCreateRepayment(shopId: Id | undefined) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (payload: RepaymentPayload) => createRepayment(shopId!, payload), onSuccess: invalidate })
}

export function useCancelRepayment(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (reason: string) => cancelRepayment(shopId!, id, reason), onSuccess: invalidate })
}

export function useOpeningBalance(shopId: Id | undefined) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (payload: Parameters<typeof createOpeningBalance>[1]) => createOpeningBalance(shopId!, payload), onSuccess: invalidate })
}

export function useCancelCredit(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (payload: { reason: string } & CancelSettlement) => cancelCredit(shopId!, id, payload), onSuccess: invalidate })
}

export function useAdjustCredit(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (payload: { amount: string; reason: string }) => adjustCredit(shopId!, id, payload), onSuccess: invalidate })
}

export function useSetInstallments(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (items: InstallmentScheduleItem[]) => setInstallments(shopId!, id, items), onSuccess: invalidate })
}

export function useRepaymentShareLink(shopId: Id | undefined, id: Id) {
  return useMutation({ mutationFn: () => createRepaymentShareLink(shopId!, id) })
}
