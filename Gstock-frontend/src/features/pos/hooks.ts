import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { createSale, getPosBootstrap, getSale, quoteSale } from '@/lib/api/sales'
import type { Id } from '@/types/api'
import type { SalePayload, SalePaymentInput, SaleQuoteInput } from '@/types/sales'
import type { Cart } from './store'

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
export function useSaleQuote(shopId: Id | undefined, input: SaleQuoteInput | null) {
  const serialized = useDebouncedValue(input ? JSON.stringify(input) : null, 150)
  return useQuery({
    queryKey: ['pos', shopId, 'quote', serialized],
    queryFn: () => quoteSale(shopId!, JSON.parse(serialized!) as SaleQuoteInput),
    enabled: shopId !== undefined && serialized !== null && (input?.items.length ?? 0) > 0,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useCreateSale(shopId: Id | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SalePayload) => createSale(shopId!, payload),
    onSuccess: () => {
      // Le stock, les ventes et les soldes clients ont changé.
      for (const k of ['pos', 'sales', 'stock', 'products', 'customers']) void queryClient.invalidateQueries({ queryKey: [k] })
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
