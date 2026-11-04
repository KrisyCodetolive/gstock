import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelSale, createShareLink, getPublicReceipt, getReceipt, getSale, listSales } from '@/lib/api/sales'
import type { Id, ListParams } from '@/types/api'

// Les ventes portent la boutique dans leur clé de cache (§6.2).
export function useSales(shopId: Id | undefined, params: ListParams) {
  return useQuery({
    queryKey: ['sales', shopId, 'list', params],
    queryFn: () => listSales(shopId!, params),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useSale(shopId: Id | undefined, id: Id) {
  return useQuery({ queryKey: ['sales', shopId, 'detail', id], queryFn: () => getSale(shopId!, id), enabled: shopId !== undefined })
}

export function useReceipt(shopId: Id | undefined, id: Id) {
  return useQuery({ queryKey: ['sales', shopId, 'receipt', id], queryFn: () => getReceipt(shopId!, id), enabled: shopId !== undefined })
}

export function usePublicReceipt(token: string) {
  return useQuery({ queryKey: ['public-receipt', token], queryFn: () => getPublicReceipt(token), retry: false })
}

export function useCancelSale(shopId: Id | undefined, id: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof cancelSale>[2]) => cancelSale(shopId!, id, payload),
    onSuccess: () => {
      // Stock restitué, crédit annulé : tout ce qui en dépend est rafraîchi.
      for (const k of ['sales', 'stock', 'products', 'customers', 'pos', 'credits']) void queryClient.invalidateQueries({ queryKey: [k] })
    },
  })
}

export function useShareLink(shopId: Id | undefined, id: Id) {
  return useMutation({ mutationFn: () => createShareLink(shopId!, id) })
}
