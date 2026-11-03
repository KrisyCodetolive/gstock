// Contrat d'API du module M04 : utilisateurs, rôles et permissions.
import type { Id, IsoDate } from './api'
import type { Permission, Role, ShopSummary, User } from './auth'

/** GET /permissions : liste fixe, lecture seule (ADR-014). */
export interface PermissionDefinition {
  name: Permission
  label: string
  level: 'tenant' | 'shop'
  group: PermissionGroup
}

export type PermissionGroup =
  | 'subscription'
  | 'shops'
  | 'users'
  | 'settings'
  | 'catalog'
  | 'customers'
  | 'suppliers'
  | 'general'
  | 'sales'
  | 'credits'
  | 'stock'
  | 'purchases'
  | 'expenses'

/** Ressource /roles */
export interface RoleDetail extends Role {
  description: string | null
  permissions: Permission[]
  users_count: number
}

export interface RolePayload {
  name: string
  description: string | null
  permissions: Permission[]
}

/** Ressource /users */
export interface UserDetail extends User {
  role: Role
  shops: ShopSummary[]
  is_active: boolean
  last_login_at: IsoDate | null
}

export interface UserPayload {
  firstname: string
  lastname: string
  email: string | null
  phone: string | null
  role_id: Id
  /** Obligatoire à la création, facultatif ensuite. */
  password?: string
}
