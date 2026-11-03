import { useCan } from '@/features/auth/hooks'
import { NAV_ITEMS, type NavItem } from '../navigation'

/** Rubriques visibles pour l'utilisateur connecté (§6.2). */
export function useAllowedNav(): NavItem[] {
  const can = useCan()
  return NAV_ITEMS.filter((item) => !item.permissions || can(item.permissions))
}
