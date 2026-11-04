// Endpoints simulés du module M03 : paramètres et clés GeniusPay.
import { delay, http, HttpResponse } from 'msw'
import { audit } from '../audit'
import type { PaymentSettings, PaymentSettingsPayload, TenantSettingsPayload } from '@/types/settings'
import { db, persist } from '../db'
import { API, handle, nullable, requirePermission, Validator } from '../http'
import { planLimits } from '../platform'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const settingsResource = () => ({ ...db.settings, plan: planLimits() })

/** Les clés ne sortent jamais en clair : seulement un indice (M03). */
function paymentResource(): PaymentSettings {
  const s = db.paymentSettings
  return {
    provider: s.provider,
    api_key_hint: s.api_key ? `•••• ${s.api_key.slice(-4)}` : null,
    has_api_secret: Boolean(s.api_secret),
    has_webhook_secret: Boolean(s.webhook_secret),
    is_sandbox: s.is_sandbox,
    is_active: s.is_active,
    updated_at: s.updated_at,
  }
}

export const settingsHandlers = [
  http.get(`${API}/settings`, () =>
    handle(async () => {
      await delay(250)
      requirePermission('settings.manage')
      return HttpResponse.json({ data: settingsResource() })
    }),
  ),

  http.put(`${API}/settings`, ({ request }) =>
    handle(async () => {
      await delay(400)
      requirePermission('settings.manage')
      const body = (await request.json()) as Partial<TenantSettingsPayload>

      const v = new Validator()
      v.required(body.name, 'name', 'Donnez un nom à votre commerce.')
      v.check(!body.email || EMAIL.test(body.email), 'email', "Cette adresse e-mail n'est pas valide.")
      v.done()

      Object.assign(db.settings, {
        name: body.name!.trim(),
        phone: nullable(body.phone),
        email: nullable(body.email),
        address: nullable(body.address),
        timezone: body.timezone || db.settings.timezone,
        receipt_footer: nullable(body.receipt_footer),
        advanced_mode: Boolean(body.advanced_mode),
      })
      persist()
      return HttpResponse.json({ data: settingsResource() })
    }),
  ),

  http.get(`${API}/settings/payment`, () =>
    handle(async () => {
      await delay(250)
      requirePermission('payment_settings.manage')
      return HttpResponse.json({ data: paymentResource() })
    }),
  ),

  http.put(`${API}/settings/payment`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const user = requirePermission('payment_settings.manage')
      const body = (await request.json()) as PaymentSettingsPayload
      const s = db.paymentSettings

      const apiKey = nullable(body.api_key) ?? s.api_key
      const apiSecret = nullable(body.api_secret) ?? s.api_secret
      const v = new Validator()
      if (body.is_active) {
        v.check(Boolean(apiKey), 'api_key', 'Saisissez la clé API pour activer les paiements en ligne.')
        v.check(Boolean(apiSecret), 'api_secret', 'Saisissez la clé secrète pour activer les paiements en ligne.')
      }
      v.done()

      Object.assign(s, {
        api_key: apiKey,
        api_secret: apiSecret,
        webhook_secret: nullable(body.webhook_secret) ?? s.webhook_secret,
        is_sandbox: Boolean(body.is_sandbox),
        is_active: Boolean(body.is_active),
        updated_at: new Date().toISOString(),
      })
      // Jamais les clés elles-mêmes dans le journal : seulement ce qui a changé.
      audit(user, 'payment_settings.updated', {
        new: { cle_api_changee: Boolean(nullable(body.api_key)), cle_secrete_changee: Boolean(nullable(body.api_secret)), mode_test: s.is_sandbox, actif: s.is_active },
      })
      persist()
      return HttpResponse.json({ data: paymentResource() })
    }),
  ),

  http.post(`${API}/settings/payment/test`, () =>
    handle(async () => {
      await delay(900)
      requirePermission('payment_settings.manage')
      const s = db.paymentSettings
      const ok = Boolean(s.api_key && s.api_secret)
      return HttpResponse.json({
        data: ok
          ? { ok, message: s.is_sandbox ? 'Connexion réussie à GeniusPay (mode test).' : 'Connexion réussie à GeniusPay.' }
          : { ok, message: 'Connexion impossible : enregistrez d’abord la clé API et la clé secrète.' },
      })
    }),
  ),
]
