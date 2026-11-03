import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelAdjustment,
  createAdjustment,
  getAdjustment,
  listMovements,
  listShopStock,
  listStockOverview,
} from '@/lib/api/stock'
import type { Id, ListParams } from '@/types/api'
import type { AdjustmentPayload } from '@/types/stock'

// Toutes les données de stock d'une boutique portent son id : changer de boutique
// change de cache, sans mélange (§6.2).
const stockKey = ['stock'] as const

export function useShopStock(shopId: Id | undefined, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [...stockKey, shopId, 'list', params],
    queryFn: () => listShopStock(shopId!, params),
    enabled: enabled && shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useStockOverview(params: ListParams, enabled: boolean) {
  return useQuery({
    queryKey: [...stockKey, 'overview', params],
    queryFn: () => listStockOverview(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useMovements(shopId: Id | undefined, params: ListParams & { productId?: Id }) {
  return useQuery({
    queryKey: [...stockKey, shopId, 'movements', params],
    queryFn: () => listMovements(shopId!, params),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useAdjustment(shopId: Id | undefined, id: Id) {
  return useQuery({
    queryKey: [...stockKey, shopId, 'adjustment', id],
    queryFn: () => getAdjustment(shopId!, id),
    enabled: shopId !== undefined,
  })
}

/** Après un mouvement : stock, mouvements et quantités des produits sont à rafraîchir. */
function useInvalidateStock() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: stockKey })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
  }
}

export function useCreateAdjustment(shopId: Id | undefined) {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (payload: AdjustmentPayload) => createAdjustment(shopId!, payload),
    onSuccess: invalidate,
  })
}

export function useCancelAdjustment(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (reason: string) => cancelAdjustment(shopId!, id, reason),
    onSuccess: invalidate,
  })
}
