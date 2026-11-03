// Rubriques de l'application : une seule liste pour le menu, la barre basse,
// les actions rapides de l'accueil et les gardes de route.
import {
  BookOpenText,
  Boxes,
  ClipboardList,
  House,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import type { ParseKeys } from 'i18next'
import { ANY_SETTINGS_PERMISSION } from '@/features/settings/sections'
import type { Permission } from '@/types/auth'

export interface NavItem {
  id: string
  path: string
  label: ParseKeys
  /** Libellé court pour la barre basse mobile. */
  shortLabel?: ParseKeys
  /** Phrase affichée sur la carte d'action rapide de l'accueil. */
  description?: ParseKeys
  icon: LucideIcon
  /** Une seule de ces permissions suffit. Absent : accessible à tous. */
  permissions?: readonly Permission[]
  /** Phase du frontend qui livre la rubrique (§11.4). */
  phase?: string
  /** Teinte de la vignette sur l'accueil. */
  tint?: 'peach' | 'yellow' | 'mint' | 'lavender'
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', path: '/', label: 'nav.home', icon: House },
  {
    id: 'sell', path: '/vendre', label: 'nav.sell', description: 'home.sell_text',
    icon: ShoppingCart, permissions: ['sales.create'], phase: 'F4', tint: 'peach',
  },
  {
    id: 'credits', path: '/credits', label: 'nav.credits', shortLabel: 'nav.credits_short',
    description: 'home.credits_text', icon: WalletCards, permissions: ['credits.view'], phase: 'F5', tint: 'lavender',
  },
  {
    id: 'stock', path: '/stock', label: 'nav.stock', shortLabel: 'nav.stock_short',
    description: 'home.stock_text', icon: Boxes, permissions: ['stock.view'], phase: 'F3', tint: 'mint',
  },
  {
    id: 'sales', path: '/ventes', label: 'nav.sales', description: 'home.sales_text',
    icon: ReceiptText, permissions: ['sales.view'], phase: 'F4', tint: 'yellow',
  },
  {
    id: 'customers', path: '/clients', label: 'nav.customers', description: 'home.customers_text',
    icon: Users, permissions: ['customers.view'], phase: 'F4', tint: 'peach',
  },
  {
    id: 'products', path: '/produits', label: 'nav.products', description: 'home.products_text',
    icon: Package, permissions: ['products.view'], tint: 'yellow',
  },
  {
    id: 'purchases', path: '/approvisionnements', label: 'nav.purchases', description: 'home.purchases_text',
    icon: Truck, permissions: ['purchases.view'], phase: 'F6', tint: 'mint',
  },
  {
    id: 'suppliers', path: '/fournisseurs', label: 'nav.suppliers',
    icon: ClipboardList, permissions: ['suppliers.view'], phase: 'F6',
  },
  {
    id: 'expenses', path: '/depenses', label: 'nav.expenses', description: 'home.expenses_text',
    icon: Wallet, permissions: ['expenses.view'], phase: 'F6', tint: 'lavender',
  },
  {
    id: 'audit', path: '/journal', label: 'nav.audit', description: 'home.audit_text',
    icon: BookOpenText, permissions: ['audit.view'], phase: 'F7',
  },
  {
    id: 'settings', path: '/parametres', label: 'nav.settings', description: 'home.settings_text',
    icon: Settings, permissions: ANY_SETTINGS_PERMISSION,
  },
]

/** Entrées de la barre basse mobile, dans l'ordre ; « Vendre » au centre. */
export const BOTTOM_NAV_IDS = ['home', 'stock', 'sell', 'credits'] as const

export function navItem(id: string): NavItem {
  const item = NAV_ITEMS.find((i) => i.id === id)
  if (!item) throw new Error(`Rubrique inconnue : ${id}`)
  return item
}
