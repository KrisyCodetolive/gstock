import { useCurrentShopStore } from '@/lib/current-shop'
import type { ShopSummary } from '@/types/auth'
import { useSession } from '@/features/auth/hooks'

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
