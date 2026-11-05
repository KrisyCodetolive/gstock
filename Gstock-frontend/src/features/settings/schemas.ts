import { z } from 'zod'
import i18n from '@/lib/i18n'

const optionalText = z.string().trim()

export const tenantSettingsSchema = z.object({
  name: z.string().trim().min(1, i18n.t('settings.tenant.required_name')),
  phone: optionalText,
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, i18n.t('settings.tenant.invalid_email')),
  address: optionalText,
  timezone: z.string().min(1),
  receipt_footer: optionalText,
  advanced_mode: z.boolean(),
  /** Délai d'alerte de péremption par défaut, en jours (§7.11). */
  expiry_alert_days: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) <= 365, i18n.t('settings.tenant.invalid_expiry_alert_days')),
})

export type TenantSettingsForm = z.infer<typeof tenantSettingsSchema>

export const paymentSettingsSchema = z.object({
  api_key: optionalText,
  api_secret: optionalText,
  webhook_secret: optionalText,
  is_sandbox: z.boolean(),
  is_active: z.boolean(),
})

export type PaymentSettingsForm = z.infer<typeof paymentSettingsSchema>

/** Fuseaux horaires proposés : Afrique de l'Ouest et du Centre. */
export const TIMEZONES = [
  { value: 'Africa/Abidjan', label: "Côte d'Ivoire — Abidjan (GMT)" },
  { value: 'Africa/Dakar', label: 'Sénégal — Dakar (GMT)' },
  { value: 'Africa/Bamako', label: 'Mali — Bamako (GMT)' },
  { value: 'Africa/Ouagadougou', label: 'Burkina Faso — Ouagadougou (GMT)' },
  { value: 'Africa/Lome', label: 'Togo — Lomé (GMT)' },
  { value: 'Africa/Conakry', label: 'Guinée — Conakry (GMT)' },
  { value: 'Africa/Porto-Novo', label: 'Bénin — Porto-Novo (GMT+1)' },
  { value: 'Africa/Niamey', label: 'Niger — Niamey (GMT+1)' },
  { value: 'Africa/Douala', label: 'Cameroun — Douala (GMT+1)' },
] as const
