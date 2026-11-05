import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelAdjustment,
  createAdjustment,
  getAdjustment,
  listMovements,
  listShopStock,
  listStockLots,
  listStockOverview,
  updateStockLot,
} from '@/lib/api/stock'
import { cancelTransfer, getTransfer, listTransfers, receiveTransfer, sendTransfer } from '@/lib/api/transfers'
import type { Id, ListParams } from '@/types/api'
import type { AdjustmentPayload, TransferPayload, TransferReceivePayload } from '@/types/stock'

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

/** Arrivages d'un article suivi dans une boutique (§7.11). */
export function useStockLots(shopId: Id | undefined, productId: Id, variantId: Id | null, enabled = true) {
  return useQuery({
    queryKey: [...stockKey, shopId, 'lots', productId, variantId],
    queryFn: () => listStockLots(shopId!, productId, variantId),
    enabled: enabled && shopId !== undefined,
  })
}

export function useUpdateStockLot(shopId: Id | undefined) {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: ({ id, expiryDate }: { id: Id; expiryDate: string | null }) => updateStockLot(shopId!, id, expiryDate),
    onSuccess: invalidate,
  })
}

/** Transferts envoyés ou reçus par la boutique (§7.12). */
export function useTransfers(shopId: Id | undefined, params: ListParams & { direction?: 'out' | 'in' }, enabled = true) {
  return useQuery({
    queryKey: [...stockKey, shopId, 'transfers', params],
    queryFn: () => listTransfers(shopId!, params),
    enabled: enabled && shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useTransfer(shopId: Id | undefined, id: Id) {
  return useQuery({
    queryKey: [...stockKey, shopId, 'transfer', id],
    queryFn: () => getTransfer(shopId!, id),
    enabled: shopId !== undefined,
  })
}

/** Envoi, réception, annulation : le stock des boutiques change, le tableau de bord aussi. */
function useInvalidateTransfers() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateStock()
  return () => {
    invalidate()
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useSendTransfer(shopId: Id | undefined) {
  const invalidate = useInvalidateTransfers()
  return useMutation({ mutationFn: (payload: TransferPayload) => sendTransfer(shopId!, payload), onSuccess: invalidate })
}

export function useReceiveTransfer(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidateTransfers()
  return useMutation({ mutationFn: (payload: TransferReceivePayload) => receiveTransfer(shopId!, id, payload), onSuccess: invalidate })
}

export function useCancelTransfer(shopId: Id | undefined, id: Id) {
  const invalidate = useInvalidateTransfers()
  return useMutation({ mutationFn: (reason: string) => cancelTransfer(shopId!, id, reason), onSuccess: invalidate })
}
