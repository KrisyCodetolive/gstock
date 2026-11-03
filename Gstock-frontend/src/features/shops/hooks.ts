import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createShop, getShop, listShops, updateShop } from '@/lib/api/shops'
import { useCurrentShopStore } from '@/lib/current-shop'
import type { Id, ListParams } from '@/types/api'
import type { ShopSummary } from '@/types/auth'
import type { ShopPayload } from '@/types/settings'
import { meQueryKey, useSession } from '@/features/auth/hooks'

/**
 * Boutique courante parmi celles accessibles à l'utilisateur.
 * Si la boutique mémorisée n'est plus accessible, on prend la première.
 */
export function useCurrentShop(): {
  shop: ShopSummary | undefined
  shops: ShopSummary[]
  setShopId: (id: number) => void
} {
  const { shops } = useSession()
  const shopId = useCurrentShopStore((s) => s.shopId)
  const setShopId = useCurrentShopStore((s) => s.setShopId)
  const shop = shops.find((s) => s.id === shopId) ?? shops[0]
  return { shop, shops, setShopId }
}

const shopsKey = ['shops'] as const

export function useShops(params: ListParams) {
  return useQuery({
    queryKey: [...shopsKey, 'list', params],
    queryFn: () => listShops(params),
    placeholderData: keepPreviousData,
  })
}

export function useShop(id: Id | undefined) {
  return useQuery({
    queryKey: [...shopsKey, 'detail', id],
    queryFn: () => getShop(id!),
    enabled: id !== undefined,
  })
}

/** Création ou modification ; le sélecteur de boutique est rafraîchi. */
export function useSaveShop(id?: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ShopPayload) => (id === undefined ? createShop(payload) : updateShop(id, payload)),
    onSuccess: (shop) => {
      queryClient.setQueryData([...shopsKey, 'detail', shop.id], shop)
      void queryClient.invalidateQueries({ queryKey: [...shopsKey, 'list'] })
      void queryClient.invalidateQueries({ queryKey: meQueryKey })
    },
  })
}
