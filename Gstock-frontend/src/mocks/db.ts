// Base de données simulée : part des jeux de démonstration et garde les
// modifications dans le navigateur, pour qu'elles survivent à un rechargement.
import type { Brand, Category, ExpenseCategory, PaymentMethod, Unit } from '@/types/referentials'
import type { PlanLimits, Shop, TenantSettings } from '@/types/settings'
import * as clients from './data/customers'
import * as catalog from './data/products'
import * as buying from './data/purchases'
import * as referentials from './data/referentials'
import * as tenant from './data/tenant'
import * as people from './data/users'
import type { MockAuditLog } from './audit'
import type { MockSale } from './sales'

type Row<T> = Omit<T, 'products_count' | 'users_count'>

export interface MockDb {
  settings: Omit<TenantSettings, 'plan'>
  planLimits: PlanLimits
  paymentSettings: tenant.StoredPaymentSettings
  shops: Row<Shop>[]
  roles: people.MockRole[]
  users: people.MockUser[]
  categories: Row<Category>[]
  units: Row<Unit>[]
  paymentMethods: PaymentMethod[]
  expenseCategories: ExpenseCategory[]
  brands: Brand[]
  products: catalog.MockProduct[]
  shopStock: catalog.MockShopStock[]
  movements: catalog.MockMovement[]
  adjustments: catalog.MockAdjustment[]
  customers: clients.MockCustomer[]
  credits: clients.MockCredit[]
  repayments: clients.MockRepayment[]
  creditAdjustments: clients.MockCreditAdjustment[]
  creditNotes: clients.MockCreditNoteEntry[]
  customerRefunds: clients.MockCustomerRefund[]
  sales: MockSale[]
  suppliers: buying.MockSupplier[]
  purchases: buying.MockPurchase[]
  expenses: buying.MockExpense[]
  auditLogs: MockAuditLog[]
  /** document_sequences : prochain numéro par préfixe (§7.9). */
  sequences: Record<string, number>
  /** Vrai quand l'historique de démonstration (ventes, crédits) a été généré. */
  seeded: boolean
}

/** À incrémenter quand les jeux de démonstration changent de forme. */
const KEY = 'gstock.mock.db.v6'

function seed(): MockDb {
  return structuredClone({
    settings: tenant.tenantSettings,
    planLimits: tenant.planLimits,
    paymentSettings: tenant.paymentSettings,
    shops: tenant.shops,
    roles: people.roles,
    users: people.users,
    categories: [...referentials.categories, ...catalog.extraCategories],
    units: referentials.units,
    paymentMethods: referentials.paymentMethods,
    expenseCategories: referentials.expenseCategories,
    brands: referentials.brands,
    products: catalog.products,
    shopStock: catalog.shopStock,
    movements: catalog.movements,
    adjustments: catalog.adjustments,
    customers: clients.customers,
    credits: [],
    repayments: [],
    creditAdjustments: [],
    creditNotes: [],
    customerRefunds: [],
    sales: [],
    suppliers: buying.suppliers,
    purchases: [],
    expenses: [],
    auditLogs: [],
    sequences: { MS: 1, V: 1, CR: 1, RB: 1, AP: 1, DP: 1 },
    seeded: false,
  })
}

function load(): MockDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    // Données illisibles : on repart du jeu de démonstration.
  }
  return seed()
}

export const db: MockDb = load()

/** Enregistre l'état après une modification. */
export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Stockage indisponible : les modifications restent en mémoire.
  }
}

/** Remet les données de démonstration à zéro. */
export function resetDb() {
  localStorage.removeItem(KEY)
  Object.assign(db, seed())
}

export function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1
}

/** Prochaine référence PRÉFIXE-N, numérotée par espace (§7.9). */
export function nextReference(prefix: string): string {
  const n = db.sequences[prefix] ?? 1
  db.sequences[prefix] = n + 1
  return `${prefix}-${n}`
}
