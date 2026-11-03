// Exemples de configuration proposés à la création d'un rôle (§6.4).
// Ce ne sont pas des rôles : rien n'est enregistré tant que le propriétaire ne valide pas.
import type { ParseKeys } from 'i18next'
import type { Permission } from '@/types/auth'

export interface RoleExample {
  id: string
  label: ParseKeys
  permissions: Permission[]
}

export const ROLE_EXAMPLES: RoleExample[] = [
  {
    id: 'seller',
    label: 'roles.examples.seller',
    permissions: [
      'products.view', 'customers.view', 'customers.create',
      'dashboard.view', 'sales.create', 'sales.view',
      'credits.view', 'credits.create', 'stock.view',
    ],
  },
  {
    id: 'cashier',
    label: 'roles.examples.cashier',
    permissions: [
      'products.view', 'customers.view',
      'dashboard.view', 'sales.create', 'sales.view',
      'credits.view', 'repayments.create',
      'expenses.view', 'expenses.create',
    ],
  },
  {
    id: 'stock_keeper',
    label: 'roles.examples.stock_keeper',
    permissions: [
      'products.view', 'products.create', 'products.update',
      'categories.manage', 'units.manage',
      'suppliers.view', 'suppliers.manage',
      'dashboard.view', 'stock.view', 'stock.entry', 'stock.exit', 'stock.adjust',
      'purchases.view', 'purchases.create',
    ],
  },
  {
    id: 'manager',
    label: 'roles.examples.manager',
    permissions: [
      'products.view', 'products.create', 'products.update', 'products.disable',
      'categories.manage', 'units.manage',
      'customers.view', 'customers.create', 'customers.update',
      'suppliers.view', 'suppliers.manage',
      'dashboard.view', 'records.view_all', 'audit.view',
      'sales.create', 'sales.view', 'sales.cancel', 'sales.edit_price', 'sales.give_discount',
      'credits.view', 'credits.create', 'credits.cancel', 'credits.opening_balance',
      'repayments.create', 'repayments.cancel',
      'stock.view', 'stock.entry', 'stock.exit', 'stock.adjust',
      'purchases.view', 'purchases.create', 'purchases.cancel', 'purchase_payments.create',
      'expenses.view', 'expenses.create', 'expenses.cancel',
    ],
  },
]
