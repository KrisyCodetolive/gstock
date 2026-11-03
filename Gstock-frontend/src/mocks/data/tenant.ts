// Espace de démonstration (cahier §11.3) : un commerçant, deux boutiques.
import type { PaymentSettings, PlanLimits, Shop, TenantSettings } from '@/types/settings'

export const tenantSettings: TenantSettings = {
  name: 'Alimentation Koné',
  logo_url: null,
  phone: '0700000001',
  email: 'contact@alimentation-kone.ci',
  address: 'Angré 8e tranche, Cocody, Abidjan',
  currency: 'XOF',
  timezone: 'Africa/Abidjan',
  receipt_footer: 'Merci pour votre confiance. À bientôt !',
  advanced_mode: false,
}

export const planLimits: PlanLimits = { max_shops: 3, max_users: 10 }

type ShopSeed = Omit<Shop, 'users_count'>

export const shops: ShopSeed[] = [
  {
    id: 1, name: 'Boutique Cocody', city: 'Abidjan', district: 'Angré', address: 'Carrefour Angré Château',
    phone: '0700000011', receipt_note: null, receipt_show_customer: true, receipt_show_phone: true,
    auto_print_receipt: false, default_customer_id: null, is_active: true,
  },
  {
    id: 2, name: 'Boutique Yopougon', city: 'Abidjan', district: 'Siporex', address: 'Face à la pharmacie Siporex',
    phone: '0700000012', receipt_note: null, receipt_show_customer: true, receipt_show_phone: true,
    auto_print_receipt: false, default_customer_id: null, is_active: true,
  },
]

/** Clés GeniusPay stockées « chiffrées » côté serveur : jamais renvoyées. */
export interface StoredPaymentSettings extends Omit<PaymentSettings, 'api_key_hint' | 'has_api_secret' | 'has_webhook_secret'> {
  api_key: string | null
  api_secret: string | null
  webhook_secret: string | null
}

export const paymentSettings: StoredPaymentSettings = {
  provider: 'geniuspay',
  api_key: null,
  api_secret: null,
  webhook_secret: null,
  is_sandbox: true,
  is_active: false,
  updated_at: null,
}
