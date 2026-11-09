import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  addPurchasePayment,
  assignPurchaseSupplier,
  cancelExpense,
  cancelPurchase,
  createExpense,
  createPurchase,
  createSupplier,
  getPurchase,
  getSupplier,
  listExpenses,
  listPurchases,
  listSuppliers,
  quotePurchase,
  updateSupplier,
  setPurchaseInstallments,
} from '@/lib/api/purchases'
import type { Id, ListParams } from '@/types/api'
import type { InstallmentScheduleItem } from '@/types/credits'
import type { ExpensePayload, PurchasePayload, PurchaseQuoteInput, SupplierPayload } from '@/types/purchases'
import { sendOrKeep } from '@/offline/send'
import type { OfflineContext } from '@/offline/queue'

export function useSuppliers(params: ListParams, enabled = true) {
  return useQuery({ queryKey: ['suppliers', 'list', params], queryFn: () => listSuppliers(params), placeholderData: keepPreviousData, enabled })
}

export function useSupplier(id: Id | undefined) {
  return useQuery({ queryKey: ['suppliers', 'detail', id], queryFn: () => getSupplier(id!), enabled: id !== undefined })
}

export function useSaveSupplier(id?: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SupplierPayload) => (id === undefined ? createSupplier(payload) : updateSupplier(id, payload)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

// Approvisionnements et dépenses portent la boutique dans leur clé de cache (§6.2).
export function usePurchases(shopId: Id | undefined, params: ListParams) {
  return useQuery({
    queryKey: ['purchases', shopId, 'list', params],
    queryFn: () => listPurchases(shopId!, params),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function usePurchase(shopId: Id | undefined, id: Id) {
  return useQuery({ queryKey: ['purchases', shopId, 'detail', id], queryFn: () => getPurchase(shopId!, id), enabled: shopId !== undefined })
}

/** Total « en direct » calculé par le serveur, 200 ms après la dernière saisie. */
export function usePurchaseQuote(shopId: Id | undefined, input: PurchaseQuoteInput | null) {
  const serialized = input && input.items.length ? JSON.stringify(input) : null
  const [debounced, setDebounced] = useState(serialized)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(serialized), 200)
    return () => clearTimeout(timer)
  }, [serialized])
  return useQuery({
    queryKey: ['purchases', shopId, 'quote', debounced],
    queryFn: () => quotePurchase(shopId!, JSON.parse(debounced!) as PurchaseQuoteInput),
    enabled: shopId !== undefined && debounced !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Un approvisionnement change le stock, les prix d'achat et les dettes fournisseurs. */
function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    for (const k of ['purchases', 'suppliers', 'stock', 'products', 'pos']) void queryClient.invalidateQueries({ queryKey: [k] })
  }
}

export function useCreatePurchase(shopId: Id | undefined) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (payload: PurchasePayload) => createPurchase(shopId!, payload), onSuccess: invalidate })
}

export function useAddPurchasePayment(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (payload: Parameters<typeof addPurchasePayment>[2]) => addPurchasePayment(shopId!, id, payload), onSuccess: invalidate })
}

export function useSetPurchaseInstallments(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (items: InstallmentScheduleItem[]) => setPurchaseInstallments(shopId!, id, items), onSuccess: invalidate })
}

/** Le reste dû passe chez le fournisseur choisi : les dettes fournisseurs changent. */
export function useAssignPurchaseSupplier(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (supplierId: Id) => assignPurchaseSupplier(shopId!, id, supplierId), onSuccess: invalidate })
}

export function useCancelPurchase(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (reason: string) => cancelPurchase(shopId!, id, reason), onSuccess: invalidate })
}

export function useExpenses(shopId: Id | undefined, params: ListParams) {
  return useQuery({
    queryKey: ['expenses', shopId, 'list', params],
    queryFn: () => listExpenses(shopId!, params),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

/** Sans réseau, la dépense est gardée sur l'appareil et envoyée plus tard (ADR-005). */
export function useCreateExpense(shopId: Id | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ payload, context }: { payload: ExpensePayload; context: OfflineContext }) =>
      sendOrKeep(() => createExpense(shopId!, payload), {
        type: 'expense',
        offline_uuid: payload.offline_uuid,
        shop_id: shopId!,
        shop_name: context.shopName,
        user_id: context.userId,
        occurred_at: payload.occurred_at ?? new Date().toISOString(),
        amount: Number(payload.amount).toFixed(2),
        label: context.label,
        payload,
      }),
    onSuccess: (result) => {
      if (result.kind === 'online') void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useCancelExpense(shopId: Id | undefined, id: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => cancelExpense(shopId!, id, reason),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
