import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { createSale, getPosBootstrap, getSale, quoteSale } from '@/lib/api/sales'
import { isOnline, useOnline } from '@/offline/network'
import { useOfflineQueue, type OfflineOperation } from '@/offline/queue'
import { localQuote, type ProvisionalQuote } from '@/offline/quote'
import type { Id } from '@/types/api'
import type { PosBootstrap, Sale, SalePayload, SalePaymentInput, SaleQuote, SaleQuoteInput } from '@/types/sales'
import type { Cart } from './store'

const isNetworkError = (e: unknown) => e instanceof ApiError && e.status === 0

/** Catalogue, stock, modes de paiement de la boutique (gardé en cache). */
export function usePosBootstrap(shopId: Id | undefined) {
  return useQuery({
    queryKey: ['pos', shopId, 'bootstrap'],
    queryFn: () => getPosBootstrap(shopId!),
    enabled: shopId !== undefined,
    staleTime: 60_000,
  })
}

export function cartToInput(cart: Cart, payments?: SalePaymentInput[]): SaleQuoteInput {
  return {
    items: cart.lines.map((l) => ({
      product_id: l.productId,
      quantity: String(l.quantity),
      ...(l.price !== undefined ? { price: l.price } : {}),
      ...(l.discount ? { discount: l.discount, discount_method: l.discountMethod ?? 'fixed' } : {}),
    })),
    ...(cart.discount ? { discount: cart.discount } : {}),
    ...(payments ? { payments } : {}),
  }
}

/**
 * Total « en direct » : le serveur recalcule les montants à chaque changement
 * du panier (§7.4). On garde l'ancien total affiché pendant le calcul.
 */
export function useSaleQuote(shopId: Id | undefined, input: SaleQuoteInput | null, bootstrap?: PosBootstrap) {
  const serialized = useDebouncedValue(input ? JSON.stringify(input) : null, 150)
  const online = useOnline()
  return useQuery<SaleQuote | ProvisionalQuote>({
    queryKey: ['pos', shopId, 'quote', serialized, online],
    queryFn: async () => {
      const body = JSON.parse(serialized!) as SaleQuoteInput
      // Sans réseau : calcul provisoire sur l'appareil, refait par le serveur à l'envoi (ADR-005).
      if (!isOnline() && bootstrap) return localQuote(body, bootstrap)
      try {
        return await quoteSale(shopId!, body)
      } catch (error) {
        if (isNetworkError(error) && bootstrap) return localQuote(body, bootstrap)
        throw error
      }
    },
    enabled: shopId !== undefined && serialized !== null && (input?.items.length ?? 0) > 0,
    placeholderData: keepPreviousData,
    networkMode: 'always',
    retry: false,
  })
}

/** Contexte d'une vente, pour la garder sur l'appareil si le réseau manque. */
export interface SaleContext {
  bootstrap: PosBootstrap
  shopName: string
  userId: Id
  customerName: string | null
}

export type CreatedSale = { kind: 'online'; sale: Sale } | { kind: 'offline'; operation: OfflineOperation; quote: ProvisionalQuote }

/** Le cache de la caisse suit la vente gardée sur l'appareil : stock et solde du client. */
function applyToBootstrap(queryClient: QueryClient, shopId: Id, payload: SalePayload, quote: ProvisionalQuote) {
  queryClient.setQueryData<PosBootstrap>(['pos', shopId, 'bootstrap'], (b) => {
    if (!b) return b
    const sold = new Map(payload.items.map((i) => [i.product_id, Number(i.quantity)]))
    return {
      ...b,
      products: b.products.map((p) => (p.quantity !== null && sold.has(p.id) ? { ...p, quantity: Math.max(0, Number(p.quantity) - sold.get(p.id)!).toFixed(3) } : p)),
      customers: b.customers.map((c) => (c.id === payload.customer_id ? { ...c, balance: (Number(c.balance) + Number(quote.credit_amount)).toFixed(2) } : c)),
    }
  })
}

export function useCreateSale(shopId: Id | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ payload, context }: { payload: SalePayload; context: SaleContext }): Promise<CreatedSale> => {
      if (isOnline()) {
        try {
          return { kind: 'online', sale: await createSale(shopId!, payload) }
        } catch (error) {
          if (!isNetworkError(error)) throw error
        }
      }
      // Sans réseau (ou coupure pendant l'envoi) : la vente est gardée avec le même offline_uuid,
      // le serveur ne l'enregistrera jamais deux fois (ADR-005). Le prix connu de l'appareil est envoyé.
      const offlinePayload: SalePayload = {
        ...payload,
        items: payload.items.map((i) => ({ ...i, price: i.price ?? context.bootstrap.products.find((p) => p.id === i.product_id)?.price })),
      }
      const quote = localQuote(offlinePayload, context.bootstrap)
      const operation = useOfflineQueue.getState().enqueue({
        type: 'sale',
        offline_uuid: payload.offline_uuid,
        shop_id: shopId!,
        shop_name: context.shopName,
        user_id: context.userId,
        occurred_at: new Date().toISOString(),
        amount: quote.total,
        label: context.customerName,
        payload: offlinePayload,
      })
      applyToBootstrap(queryClient, shopId!, offlinePayload, quote)
      return { kind: 'offline', operation, quote }
    },
    onSuccess: (result) => {
      // Le stock, les ventes et les soldes clients ont changé.
      if (result.kind === 'online') for (const k of ['pos', 'sales', 'stock', 'products', 'customers']) void queryClient.invalidateQueries({ queryKey: [k] })
    },
  })
}

/** Suit une vente dont un paiement GeniusPay attend le webhook (ADR-003). */
export function useSaleConfirmation(shopId: Id | undefined, saleId: Id | undefined, waiting: boolean) {
  return useQuery({
    queryKey: ['sales', shopId, 'detail', saleId],
    queryFn: () => getSale(shopId!, saleId!),
    enabled: waiting && shopId !== undefined && saleId !== undefined,
    refetchInterval: (q) => (q.state.data?.payments.some((p) => p.status === 'pending') === false ? false : 2000),
  })
}
