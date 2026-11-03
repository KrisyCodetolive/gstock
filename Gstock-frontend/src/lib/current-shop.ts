// Boutique courante, gardée entre deux visites sur le même appareil.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Id } from '@/types/api'

interface CurrentShopState {
  shopId: Id | null
  setShopId: (id: Id | null) => void
}

export const useCurrentShopStore = create<CurrentShopState>()(
  persist(
    (set) => ({
      shopId: null,
      setShopId: (shopId) => set({ shopId }),
    }),
    { name: 'gstock.current-shop' },
  ),
)
