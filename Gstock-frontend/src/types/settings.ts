// Contrat d'API du module M03 : espace, boutiques et paramètres.
import type { Id, IsoDate } from './api'

/** GET|PUT /settings */
export interface TenantSettings {
  name: string
  logo_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  currency: 'XOF'
  timezone: string
  receipt_footer: string | null
  /** Variantes, taxes, unités multiples, marques (§3.1). */
  advanced_mode: boolean
  /** Plan d'abonnement, en lecture seule ici. */
  plan: PlanLimits
}

export type TenantSettingsPayload = Omit<TenantSettings, 'logo_url' | 'currency' | 'plan'>

/** GET|PUT /settings/payment : les clés ne sont jamais renvoyées en clair. */
export interface PaymentSettings {
  provider: 'geniuspay'
  /** Fin de la clé, ex. "•••• 4f2a", ou null si aucune clé. */
  api_key_hint: string | null
  has_api_secret: boolean
  has_webhook_secret: boolean
  is_sandbox: boolean
  is_active: boolean
  updated_at: IsoDate | null
}

export interface PaymentSettingsPayload {
  /** Laisser vide pour garder la clé enregistrée. */
  api_key?: string
  api_secret?: string
  webhook_secret?: string
  is_sandbox: boolean
  is_active: boolean
}

export interface PaymentTestResult {
  ok: boolean
  message: string
}

/** Ressource /shops */
export interface Shop {
  id: Id
  name: string
  city: string
  district: string | null
  address: string | null
  phone: string | null
  receipt_note: string | null
  receipt_show_customer: boolean
  receipt_show_phone: boolean
  auto_print_receipt: boolean
  default_customer_id: Id | null
  is_active: boolean
  users_count: number
}

export type ShopPayload = Omit<Shop, 'id' | 'users_count'>

/** Limites du plan affichées dans les paramètres. */
export interface PlanLimits {
  name: string
  max_shops: number
  max_users: number
  max_products: number
}
