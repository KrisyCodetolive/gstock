// Rôles et utilisateurs de démonstration (cahier §11.3).
// Seul Owner est prédéfini ; les autres rôles sont ceux que le propriétaire
// aurait créés lui-même (ADR-014).
import { ALL_PERMISSIONS, type Permission, type Role, type User } from '@/types/auth'

export interface MockRole extends Role {
  permissions: readonly Permission[]
}

export interface MockUser extends User {
  password: string
  role_id: number
  shop_ids: number[]
  is_active: boolean
}

/** Mot de passe commun aux comptes de démonstration. */
export const DEMO_PASSWORD = 'demo1234'

export const roles: MockRole[] = [
  { id: 1, name: 'Owner', is_owner: true, permissions: ALL_PERMISSIONS },
  {
    id: 2,
    name: 'Gérant',
    is_owner: false,
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
  {
    id: 3,
    name: 'Vendeur',
    is_owner: false,
    permissions: [
      'products.view', 'customers.view', 'customers.create',
      'dashboard.view', 'sales.create', 'sales.view',
      'credits.view', 'credits.create', 'stock.view',
    ],
  },
  {
    id: 4,
    name: 'Caissier',
    is_owner: false,
    permissions: [
      'products.view', 'customers.view',
      'dashboard.view', 'sales.create', 'sales.view',
      'credits.view', 'repayments.create',
      'expenses.view', 'expenses.create',
    ],
  },
  {
    id: 5,
    name: 'Gestionnaire de stock',
    is_owner: false,
    permissions: [
      'products.view', 'products.create', 'products.update',
      'categories.manage', 'units.manage',
      'suppliers.view', 'suppliers.manage',
      'dashboard.view',
      'stock.view', 'stock.entry', 'stock.exit', 'stock.adjust',
      'purchases.view', 'purchases.create',
    ],
  },
]

export const users: MockUser[] = [
  {
    id: 1, firstname: 'Aminata', lastname: 'Koné', email: 'aminata@demo.gstock.app', phone: '0700000001',
    avatar_url: null, password: DEMO_PASSWORD, role_id: 1, shop_ids: [1, 2], is_active: true,
  },
  {
    id: 2, firstname: 'Ibrahim', lastname: 'Traoré', email: 'ibrahim@demo.gstock.app', phone: '0700000002',
    avatar_url: null, password: DEMO_PASSWORD, role_id: 2, shop_ids: [1, 2], is_active: true,
  },
  {
    id: 3, firstname: 'Fatou', lastname: 'Bamba', email: 'fatou@demo.gstock.app', phone: '0700000003',
    avatar_url: null, password: DEMO_PASSWORD, role_id: 3, shop_ids: [1], is_active: true,
  },
  {
    id: 4, firstname: 'Koffi', lastname: "N'Guessan", email: 'koffi@demo.gstock.app', phone: '0700000004',
    avatar_url: null, password: DEMO_PASSWORD, role_id: 4, shop_ids: [2], is_active: true,
  },
  {
    id: 5, firstname: 'Moussa', lastname: 'Diallo', email: 'moussa@demo.gstock.app', phone: '0700000005',
    avatar_url: null, password: DEMO_PASSWORD, role_id: 5, shop_ids: [1, 2], is_active: true,
  },
  {
    id: 6, firstname: 'Paul', lastname: 'Yao', email: 'paul@demo.gstock.app', phone: '0700000006',
    avatar_url: null, password: DEMO_PASSWORD, role_id: 3, shop_ids: [1], is_active: false,
  },
]
