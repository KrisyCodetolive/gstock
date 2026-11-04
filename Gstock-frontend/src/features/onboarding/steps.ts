import { Package, ShoppingCart, WalletCards, type LucideIcon } from 'lucide-react'
import type { Permission } from '@/types/auth'
import type { OnboardingStepId } from '@/types/subscription'

/** Étapes de l'assistant de démarrage (M00) : où chacune mène. */
export const ONBOARDING_STEPS: Record<OnboardingStepId, { to: string; icon: LucideIcon; tint: 'peach' | 'yellow' | 'mint' | 'lavender'; permission: Permission }> = {
  products: { to: '/produits/nouveau', icon: Package, tint: 'yellow', permission: 'products.create' },
  // /credits?ancienne=1 ouvre directement la saisie d'une ancienne dette.
  opening_balances: { to: '/credits?ancienne=1', icon: WalletCards, tint: 'lavender', permission: 'credits.opening_balance' },
  first_sale: { to: '/vendre', icon: ShoppingCart, tint: 'peach', permission: 'sales.create' },
}
