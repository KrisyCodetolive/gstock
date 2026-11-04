// Base de données simulée : part des jeux de démonstration et garde les
// modifications dans le navigateur, pour qu'elles survivent à un rechargement.
import type { Brand, Category, ExpenseCategory, PaymentMethod, Unit } from '@/types/referentials'
import type { Shop, TenantSettings } from '@/types/settings'
import * as clients from './data/customers'
import * as catalog from './data/products'
import * as buying from './data/purchases'
import * as referentials from './data/referentials'
import * as tenant from './data/tenant'
import * as people from './data/users'
import type { MockAuditLog } from './audit'
import { DEMO_SLUG, platform } from './platform'
import type { MockSale } from './sales'

type Row<T> = Omit<T, 'products_count' | 'users_count'>

export interface MockDb {
  settings: Omit<TenantSettings, 'plan'>
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
  /** Assistant de démarrage : étapes passées, assistant fermé (M00). */
  onboarding: { skipped: string[]; dismissed: boolean }
  /** Vrai quand l'historique de démonstration (ventes, crédits) a été généré. */
  seeded: boolean
}

/** À incrémenter quand les jeux de démonstration changent de forme. */
const PREFIX = 'gstock.mock.db.v9'
/** Une base par espace, comme le filtre tenant_id du serveur (ADR-002). */
const keyOf = (slug: string) => `${PREFIX}.${slug}`

function seed(): MockDb {
  return structuredClone({
    settings: tenant.tenantSettings,
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
    // L'espace de démonstration est déjà lancé : pas d'assistant.
    onboarding: { skipped: [], dismissed: true },
    seeded: false,
  })
}

function load(slug: string): MockDb {
  try {
    const raw = localStorage.getItem(keyOf(slug))
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    // Données illisibles : on repart du jeu de démonstration.
  }
  return slug === DEMO_SLUG ? seed() : emptyTenantDb()
}

/** Base de l'espace courant (le sous-domaine ouvert). */
export const db: MockDb = load(platform.current)
let loadedSlug = platform.current

/** Enregistre l'état après une modification. */
export function persist() {
  try {
    localStorage.setItem(keyOf(loadedSlug), JSON.stringify(db))
  } catch {
    // Stockage indisponible : les modifications restent en mémoire.
  }
}

/** Ouvre la base d'un autre espace (changement de sous-domaine). */
export function openTenantDb(slug: string) {
  if (slug === loadedSlug) return
  persist()
  Object.assign(db, load(slug))
  loadedSlug = slug
}

/** Enregistre la base d'un espace qui vient d'être créé. */
export function saveTenantDb(slug: string, data: MockDb) {
  localStorage.setItem(keyOf(slug), JSON.stringify(data))
}

/** Remet toute la démonstration à zéro : plateforme, espaces créés, sessions. */
export function resetAllMocks() {
  for (const key of Object.keys(localStorage)) if (key.startsWith('gstock.mock.')) localStorage.removeItem(key)
}

function emptyTenantDb(): MockDb {
  return newTenantDb({
    name: '', phone: null, email: null, shop: { name: 'Boutique principale', city: '' },
    owner: { firstname: '', lastname: '', email: null, phone: null, password: '' },
  })
}

/**
 * Provisionnement d'un nouvel espace (M00) : propriétaire avec le rôle Owner,
 * première boutique, unités, modes de paiement, catégories de dépenses, séquences.
 */
export function newTenantDb(init: {
  name: string
  phone: string | null
  email: string | null
  shop: { name: string; city: string }
  owner: { firstname: string; lastname: string; email: string | null; phone: string | null; password: string }
}): MockDb {
  const owner = people.roles.find((r) => r.is_owner)!
  return structuredClone({
    settings: { ...tenant.tenantSettings, name: init.name, phone: init.phone, email: init.email, address: null },
    paymentSettings: tenant.paymentSettings,
    shops: [{ ...tenant.shops[0]!, id: 1, name: init.shop.name, city: init.shop.city, district: null, address: null, phone: init.phone }],
    roles: [owner],
    users: [{ id: 1, ...init.owner, avatar_url: null, role_id: owner.id, shop_ids: [1], is_active: true, last_login_at: null }],
    categories: [],
    units: referentials.units,
    paymentMethods: referentials.paymentMethods,
    expenseCategories: referentials.expenseCategories,
    brands: [],
    products: [],
    shopStock: [],
    movements: [],
    adjustments: [],
    customers: [],
    credits: [],
    repayments: [],
    creditAdjustments: [],
    creditNotes: [],
    customerRefunds: [],
    sales: [],
    suppliers: [],
    purchases: [],
    expenses: [],
    auditLogs: [],
    sequences: { MS: 1, V: 1, CR: 1, RB: 1, AP: 1, DP: 1 },
    onboarding: { skipped: [], dismissed: false },
    seeded: true,
  })
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
