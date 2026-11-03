// Contrat d'API du module M05 : référentiels. Un élément utilisé se désactive,
// il ne se supprime pas.
import type { Id } from './api'

export interface Category {
  id: Id
  name: string
  /** Teinte de vignette (design system). */
  color: CategoryColor
  is_active: boolean
  products_count: number
}

export type CategoryColor = 'peach' | 'yellow' | 'mint' | 'lavender'

export interface Unit {
  id: Id
  name: string
  short_name: string
  /** Unité de base pour une unité dérivée (§7.3), sinon null. */
  base_unit_id: Id | null
  operator: '*' | '/' | null
  operator_value: string | null
  is_active: boolean
  products_count: number
}

export type PaymentMethodType = 'cash' | 'mobile_money' | 'card' | 'other'

export interface PaymentMethod {
  id: Id
  name: string
  type: PaymentMethodType
  uses_geniuspay: boolean
  is_active: boolean
}

export interface ExpenseCategory {
  id: Id
  name: string
  is_active: boolean
}

export interface Brand {
  id: Id
  name: string
  is_active: boolean
}

export type CategoryPayload = Pick<Category, 'name' | 'color' | 'is_active'>
export type UnitPayload = Pick<Unit, 'name' | 'short_name' | 'base_unit_id' | 'operator' | 'operator_value' | 'is_active'>
export type PaymentMethodPayload = Omit<PaymentMethod, 'id'>
export type ExpenseCategoryPayload = Omit<ExpenseCategory, 'id'>
export type BrandPayload = Omit<Brand, 'id'>
