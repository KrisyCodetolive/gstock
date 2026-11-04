// Contrat d'API du module M00 : inscription, abonnement, assistant de démarrage.
import type { Id, IsoDate, Money } from './api'
import type { Me } from './auth'

/** GET /plans : offres d'abonnement (limites du plan, §8.1). */
export interface Plan {
  id: Id
  name: string
  description: string
  /** Prix pour une période, en FCFA. */
  price: Money
  billing_period: 'monthly' | 'yearly'
  max_shops: number
  max_users: number
  max_products: number
  trial_days: number
  is_recommended: boolean
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled'
export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled'

/** Résumé renvoyé par GET /me, pour le bandeau et le mode lecture seule. */
export interface SubscriptionSummary {
  status: SubscriptionStatus
  tenant_status: TenantStatus
  /** Espace suspendu : consultation seulement, aucune opération (M00). */
  read_only: boolean
  /** Jours restants avant la fin de l'essai, de la période payée ou du délai de grâce. */
  days_left: number
}

export type InvoiceStatus = 'pending' | 'paid' | 'failed'

/** GET /subscription/invoices */
export interface Invoice {
  id: Id
  reference: string
  plan_name: string
  amount: Money
  status: InvoiceStatus
  /** Moyen choisi sur la page GeniusPay (Wave, Orange Money…), connu au webhook. */
  payment_channel: string | null
  created_at: IsoDate
  paid_at: IsoDate | null
}

/** GET /subscription */
export interface Subscription extends SubscriptionSummary {
  plan: Plan
  trial_ends_at: IsoDate | null
  /** Fin de la période payée (null tant que rien n'est payé). */
  ends_at: IsoDate | null
  /** Fin du délai de grâce, si l'abonnement est impayé. */
  grace_ends_at: IsoDate | null
  usage: { shops: number; users: number; products: number }
  /** Paiement lancé, en attente de la confirmation de GeniusPay (webhook). */
  pending_invoice: Invoice | null
}

/** POST /subscription/checkout */
export interface CheckoutPayload {
  plan_id: Id
}

export interface CheckoutResult {
  invoice: Invoice
  /** Page de paiement GeniusPay, qui renvoie ensuite sur « Mon abonnement ». */
  checkout_url: string
}

/** POST /register (domaine principal). */
export interface RegisterPayload {
  tenant_name: string
  /** Sous-domaine : <slug>.gstock.app (ADR-009). */
  slug: string
  shop_name: string
  shop_city: string
  firstname: string
  lastname: string
  phone: string
  email: string
  password: string
  plan_id: Id
}

export interface RegisterResult {
  tenant: { name: string; slug: string; url: string }
  /** Lien de connexion à usage unique sur le sous-domaine du nouvel espace. */
  login_url: string
}

/** GET /register/check-slug?slug= */
export interface SlugCheck {
  available: boolean
  message: string | null
  /** Proposition libre la plus proche, si le nom est pris. */
  suggestion: string | null
}

/** POST /auth/token-login : échange le lien à usage unique contre une session. */
export interface TokenLoginPayload {
  token: string
}
export type TokenLoginResult = Me

export type OnboardingStepId = 'products' | 'opening_balances' | 'first_sale'

/** GET /onboarding : assistant de démarrage du propriétaire. */
export interface Onboarding {
  steps: { id: OnboardingStepId; done: boolean; skipped: boolean }[]
  /** Toutes les étapes faites ou passées, ou assistant fermé. */
  completed: boolean
  dismissed: boolean
}
