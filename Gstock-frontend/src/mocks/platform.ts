// Plateforme simulée (tables sans tenant_id, §8.1) : espaces, plans, abonnements,
// factures. Elle vit à part de la base de chaque espace, comme sur le serveur.
// `current` joue le rôle du sous-domaine : l'espace ouvert dans le navigateur (ADR-009).
import type { Invoice, Plan, Subscription, SubscriptionStatus, SubscriptionSummary, TenantStatus } from '@/types/subscription'
import { daysAgo } from './data/dates'

const KEY = 'gstock.mock.platform.v1'
const DAY = 86_400_000
/** Délai de grâce après une échéance impayée, avant la suspension (P7 : hypothèse). */
export const GRACE_DAYS = 7
export const DEMO_SLUG = 'alimentation-kone'
/** Domaine de la plateforme (P9 : à confirmer). */
export const PLATFORM_DOMAIN = 'gstock.app'

export interface MockTenant {
  slug: string
  name: string
  owner_email: string
  phone: string
  /** `cancelled` : espace fermé par Genius Groups ; la connexion est refusée. */
  closed: boolean
  created_at: string
  activated_at: string | null
  first_sale_at: string | null
}

export interface MockSubscription {
  tenant_slug: string
  plan_id: number
  starts_at: string
  trial_ends_at: string | null
  /** Fin de la période payée. */
  ends_at: string | null
}

export interface MockInvoice {
  id: number
  tenant_slug: string
  plan_id: number
  reference: string
  amount: number
  status: Invoice['status']
  payment_channel: string | null
  geniuspay_transaction_id: string | null
  created_at: string
  paid_at: string | null
}

export interface MockLoginToken {
  token: string
  tenant_slug: string
  user_id: number
  expires_at: string
  used: boolean
}

interface PlatformDb {
  current: string
  plans: (Omit<Plan, 'price'> & { price: number })[]
  tenants: MockTenant[]
  subscriptions: MockSubscription[]
  invoices: MockInvoice[]
  loginTokens: MockLoginToken[]
  invoiceSequence: number
}

// Plans proposés en attendant la décision de l'équipe produit (P7).
const PLANS: PlatformDb['plans'] = [
  { id: 1, name: 'Essentiel', description: 'Une boutique, pour démarrer.', price: 5000, billing_period: 'monthly', max_shops: 1, max_users: 3, max_products: 300, trial_days: 14, is_recommended: false },
  { id: 2, name: 'Commerce', description: 'Plusieurs boutiques et une équipe.', price: 12000, billing_period: 'monthly', max_shops: 3, max_users: 10, max_products: 2000, trial_days: 14, is_recommended: true },
  { id: 3, name: 'Réseau', description: 'Pour les commerces qui grandissent.', price: 25000, billing_period: 'monthly', max_shops: 10, max_users: 30, max_products: 10000, trial_days: 14, is_recommended: false },
]

function seed(): PlatformDb {
  // L'espace de démonstration : essai terminé, deux mois payés, en cours jusqu'à J+14.
  return {
    current: DEMO_SLUG,
    plans: structuredClone(PLANS),
    tenants: [
      { slug: DEMO_SLUG, name: 'Alimentation Koné', owner_email: 'awa.kone@example.ci', phone: '0700000001', closed: false, created_at: daysAgo(60, 8), activated_at: daysAgo(60, 9), first_sale_at: daysAgo(31, 9) },
    ],
    subscriptions: [{ tenant_slug: DEMO_SLUG, plan_id: 2, starts_at: daysAgo(60, 8), trial_ends_at: daysAgo(46, 8), ends_at: daysAgo(-14, 8) }],
    invoices: [
      { id: 1, tenant_slug: DEMO_SLUG, plan_id: 2, reference: 'FA-1', amount: 12000, status: 'paid', payment_channel: 'Wave', geniuspay_transaction_id: 'GP-DEMO-1', created_at: daysAgo(46, 10), paid_at: daysAgo(46, 10) },
      { id: 2, tenant_slug: DEMO_SLUG, plan_id: 2, reference: 'FA-2', amount: 12000, status: 'failed', payment_channel: 'Orange Money', geniuspay_transaction_id: 'GP-DEMO-2', created_at: daysAgo(16, 11), paid_at: null },
      { id: 3, tenant_slug: DEMO_SLUG, plan_id: 2, reference: 'FA-3', amount: 12000, status: 'paid', payment_channel: 'Orange Money', geniuspay_transaction_id: 'GP-DEMO-3', created_at: daysAgo(16, 12), paid_at: daysAgo(16, 12) },
    ],
    loginTokens: [],
    invoiceSequence: 4,
  }
}

function load(): PlatformDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as PlatformDb
  } catch {
    // Données illisibles : on repart de la plateforme de démonstration.
  }
  return seed()
}

export const platform: PlatformDb = load()

export function persistPlatform() {
  try {
    localStorage.setItem(KEY, JSON.stringify(platform))
  } catch {
    // Stockage indisponible : les modifications restent en mémoire.
  }
}

/** Espace ouvert dans le navigateur (le sous-domaine). */
export function currentTenant(): MockTenant {
  return platform.tenants.find((t) => t.slug === platform.current) ?? platform.tenants[0]!
}

export function subscriptionOf(slug: string): MockSubscription {
  const s = platform.subscriptions.find((x) => x.tenant_slug === slug)
  if (!s) throw new Error(`Abonnement de ${slug} introuvable`)
  return s
}

export function planOf(id: number) {
  const plan = platform.plans.find((p) => p.id === id)
  if (!plan) throw new Error(`Plan ${id} introuvable`)
  return plan
}

export const planResource = (p: PlatformDb['plans'][number]): Plan => ({ ...p, price: p.price.toFixed(2) })

/** Plan de l'espace courant : ses limites s'appliquent aux boutiques, utilisateurs, produits. */
export function currentPlan() {
  return planOf(subscriptionOf(currentTenant().slug).plan_id)
}

/**
 * État de l'abonnement, recalculé à chaque requête à partir des dates,
 * comme le ferait la tâche planifiée du serveur.
 */
export function subscriptionState(slug: string, now = Date.now()) {
  const tenant = platform.tenants.find((t) => t.slug === slug)!
  const sub = subscriptionOf(slug)
  const paidUntil = sub.ends_at ? Date.parse(sub.ends_at) : 0
  const trialUntil = sub.trial_ends_at ? Date.parse(sub.trial_ends_at) : 0
  const end = Math.max(paidUntil, trialUntil)
  const graceEnd = end + GRACE_DAYS * DAY

  let status: SubscriptionStatus
  let tenantStatus: TenantStatus
  let until: number
  if (tenant.closed) {
    status = 'cancelled'
    tenantStatus = 'cancelled'
    until = now
  } else if (paidUntil > now) {
    status = 'active'
    tenantStatus = 'active'
    until = paidUntil
  } else if (trialUntil > now) {
    status = 'trial'
    tenantStatus = 'trial'
    until = trialUntil
  } else {
    status = 'past_due'
    tenantStatus = now < graceEnd ? (sub.ends_at ? 'active' : 'trial') : 'suspended'
    until = graceEnd
  }
  return {
    status,
    tenantStatus,
    readOnly: tenantStatus === 'suspended',
    daysLeft: Math.max(0, Math.ceil((until - now) / DAY)),
    graceEndsAt: status === 'past_due' ? new Date(graceEnd).toISOString() : null,
  }
}

export function summaryOf(slug: string): SubscriptionSummary {
  const s = subscriptionState(slug)
  return { status: s.status, tenant_status: s.tenantStatus, read_only: s.readOnly, days_left: s.daysLeft }
}

export function invoiceResource(i: MockInvoice): Invoice {
  return {
    id: i.id,
    reference: i.reference,
    plan_name: planOf(i.plan_id).name,
    amount: i.amount.toFixed(2),
    status: i.status,
    payment_channel: i.payment_channel,
    created_at: i.created_at,
    paid_at: i.paid_at,
  }
}

export function subscriptionResource(slug: string, usage: Subscription['usage']): Subscription {
  const sub = subscriptionOf(slug)
  const pending = platform.invoices.filter((i) => i.tenant_slug === slug && i.status === 'pending').at(-1)
  return {
    ...summaryOf(slug),
    plan: planResource(planOf(sub.plan_id)),
    trial_ends_at: sub.trial_ends_at,
    ends_at: sub.ends_at,
    grace_ends_at: subscriptionState(slug).graceEndsAt,
    usage,
    pending_invoice: pending ? invoiceResource(pending) : null,
  }
}

/** Facture « en attente » avant le passage sur la page GeniusPay. */
export function createInvoice(slug: string, planId: number): MockInvoice {
  const plan = planOf(planId)
  const invoice: MockInvoice = {
    id: platform.invoices.reduce((m, i) => Math.max(m, i.id), 0) + 1,
    tenant_slug: slug,
    plan_id: plan.id,
    reference: `FA-${platform.invoiceSequence++}`,
    amount: plan.price,
    status: 'pending',
    payment_channel: null,
    geniuspay_transaction_id: null,
    created_at: new Date().toISOString(),
    paid_at: null,
  }
  // Une seule facture en attente à la fois : la précédente est abandonnée.
  for (const i of platform.invoices) if (i.tenant_slug === slug && i.status === 'pending') i.status = 'failed'
  platform.invoices.push(invoice)
  persistPlatform()
  return invoice
}

/**
 * Webhook GeniusPay de la plateforme (/webhooks/geniuspay/platform, ADR-003) :
 * seul un paiement confirmé prolonge l'abonnement, d'une période à partir de la
 * fin en cours (ou d'aujourd'hui si elle est passée). Un échec ne change rien.
 * Idempotent : une facture déjà traitée n'est pas rejouée.
 */
export function geniusPayPlatformWebhook(invoiceId: number, outcome: 'success' | 'failed', channel: string) {
  const invoice = platform.invoices.find((i) => i.id === invoiceId)
  if (!invoice || invoice.status !== 'pending') return
  invoice.payment_channel = channel
  invoice.geniuspay_transaction_id = `GP-${Date.now()}`
  if (outcome === 'success') {
    const sub = subscriptionOf(invoice.tenant_slug)
    const plan = planOf(invoice.plan_id)
    const base = Math.max(Date.now(), sub.ends_at ? Date.parse(sub.ends_at) : 0, sub.trial_ends_at ? Date.parse(sub.trial_ends_at) : 0)
    const months = plan.billing_period === 'yearly' ? 12 : 1
    const end = new Date(base)
    end.setUTCMonth(end.getUTCMonth() + months)
    sub.ends_at = end.toISOString()
    sub.plan_id = plan.id
    invoice.status = 'paid'
    invoice.paid_at = new Date().toISOString()
  } else {
    invoice.status = 'failed'
  }
  persistPlatform()
}

export function isSlugTaken(slug: string) {
  return platform.tenants.some((t) => t.slug === slug)
}

export function switchCurrentTenant(slug: string) {
  platform.current = slug
  persistPlatform()
}

/** Limites affichées dans les paramètres de l'espace. */
export function planLimits() {
  const p = currentPlan()
  return { name: p.name, max_shops: p.max_shops, max_users: p.max_users, max_products: p.max_products }
}
