// Base de données simulée : part des jeux de démonstration et garde les
// modifications dans le navigateur, pour qu'elles survivent à un rechargement.
import type { Brand, Category, ExpenseCategory, PaymentMethod, Unit } from '@/types/referentials'
import type { PlanLimits, Shop, TenantSettings } from '@/types/settings'
import * as catalog from './data/products'
import * as referentials from './data/referentials'
import * as tenant from './data/tenant'
import * as people from './data/users'

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
  /** document_sequences : prochain numéro par préfixe (§7.9). */
  sequences: Record<string, number>
}

/** À incrémenter quand les jeux de démonstration changent de forme. */
const KEY = 'gstock.mock.db.v2'

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
    sequences: { MS: 1 },
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
