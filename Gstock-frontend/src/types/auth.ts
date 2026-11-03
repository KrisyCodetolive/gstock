// Contrat d'API du module M02 (authentification) et permissions du §6.3.
import type { Id } from './api'

/** Permissions d'espace : données communes à toutes les boutiques. */
export const TENANT_PERMISSIONS = [
  'subscription.manage',
  'shops.manage',
  'users.manage',
  'roles.manage',
  'settings.manage',
  'payment_settings.manage',
  'products.view',
  'products.create',
  'products.update',
  'products.disable',
  'categories.manage',
  'units.manage',
  'customers.view',
  'customers.create',
  'customers.update',
  'suppliers.view',
  'suppliers.manage',
] as const

/** Permissions de boutique : s'exercent dans les boutiques affectées. */
export const SHOP_PERMISSIONS = [
  'dashboard.view',
  'records.view_all',
  'audit.view',
  'sales.create',
  'sales.view',
  'sales.cancel',
  'sales.edit_price',
  'sales.give_discount',
  'credits.view',
  'credits.create',
  'credits.cancel',
  'credits.opening_balance',
  'repayments.create',
  'repayments.cancel',
  'stock.view',
  'stock.entry',
  'stock.exit',
  'stock.adjust',
  'purchases.view',
  'purchases.create',
  'purchases.cancel',
  'purchase_payments.create',
  'expenses.view',
  'expenses.create',
  'expenses.cancel',
] as const

export const ALL_PERMISSIONS = [...TENANT_PERMISSIONS, ...SHOP_PERMISSIONS] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

export interface User {
  id: Id
  firstname: string
  lastname: string
  email: string | null
  phone: string | null
  avatar_url: string | null
}

export interface Role {
  id: Id
  name: string
  is_owner: boolean
}

export interface ShopSummary {
  id: Id
  name: string
  city: string
  district: string | null
}

export interface TenantSummary {
  name: string
  currency: 'XOF'
  timezone: string
}

/** Réponse de GET /me : tout ce qu'il faut au chargement (menu, sélecteur). */
export interface Me {
  user: User
  role: Role
  permissions: Permission[]
  shops: ShopSummary[]
  tenant: TenantSummary
}

export interface LoginPayload {
  /** E-mail ou numéro de téléphone. */
  login: string
  password: string
}
