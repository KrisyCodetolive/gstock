// Rubriques des paramètres : une seule liste pour la page d'accueil des
// paramètres et pour les gardes de route.
import {
  Building2,
  CreditCard,
  FolderTree,
  Ruler,
  ShieldCheck,
  Smartphone,
  Store,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ParseKeys } from 'i18next'
import type { Permission } from '@/types/auth'

export interface SettingsSection {
  id: string
  path: string
  group: 'business' | 'team' | 'lists'
  label: ParseKeys
  description: ParseKeys
  icon: LucideIcon
  permissions: readonly Permission[]
  tint: 'peach' | 'yellow' | 'mint' | 'lavender'
  /** Visible seulement en mode avancé (§3.1). */
  advanced?: boolean
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'tenant', path: '/parametres/espace', group: 'business', label: 'settings.sections.tenant', description: 'settings.sections.tenant_text', icon: Building2, permissions: ['settings.manage'], tint: 'peach' },
  { id: 'shops', path: '/parametres/boutiques', group: 'business', label: 'settings.sections.shops', description: 'settings.sections.shops_text', icon: Store, permissions: ['shops.manage'], tint: 'yellow' },
  { id: 'payment', path: '/parametres/paiements-en-ligne', group: 'business', label: 'settings.sections.payment', description: 'settings.sections.payment_text', icon: Smartphone, permissions: ['payment_settings.manage'], tint: 'mint' },
  { id: 'users', path: '/parametres/utilisateurs', group: 'team', label: 'settings.sections.users', description: 'settings.sections.users_text', icon: Users, permissions: ['users.manage'], tint: 'lavender' },
  { id: 'roles', path: '/parametres/roles', group: 'team', label: 'settings.sections.roles', description: 'settings.sections.roles_text', icon: ShieldCheck, permissions: ['roles.manage'], tint: 'peach' },
  { id: 'categories', path: '/parametres/categories', group: 'lists', label: 'settings.sections.categories', description: 'settings.sections.categories_text', icon: FolderTree, permissions: ['categories.manage'], tint: 'yellow' },
  { id: 'units', path: '/parametres/unites', group: 'lists', label: 'settings.sections.units', description: 'settings.sections.units_text', icon: Ruler, permissions: ['units.manage'], tint: 'mint' },
  { id: 'payment-methods', path: '/parametres/modes-de-paiement', group: 'lists', label: 'settings.sections.payment_methods', description: 'settings.sections.payment_methods_text', icon: CreditCard, permissions: ['settings.manage'], tint: 'lavender' },
  { id: 'expense-categories', path: '/parametres/categories-de-depenses', group: 'lists', label: 'settings.sections.expense_categories', description: 'settings.sections.expense_categories_text', icon: Wallet, permissions: ['settings.manage'], tint: 'peach' },
  { id: 'brands', path: '/parametres/marques', group: 'lists', label: 'settings.sections.brands', description: 'settings.sections.brands_text', icon: Tag, permissions: ['settings.manage'], tint: 'yellow', advanced: true },
]

/** Toutes les permissions qui donnent accès à au moins une rubrique. */
export const ANY_SETTINGS_PERMISSION: readonly Permission[] = [...new Set(SETTINGS_SECTIONS.flatMap((s) => s.permissions))]

export function settingsSection(id: string): SettingsSection {
  const section = SETTINGS_SECTIONS.find((s) => s.id === id)
  if (!section) throw new Error(`Rubrique de paramètres inconnue : ${id}`)
  return section
}
