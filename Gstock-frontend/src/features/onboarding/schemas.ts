import type { ParseKeys } from 'i18next'
import { z } from 'zod'
import i18n from '@/lib/i18n'

const required = (key: ParseKeys) => z.string().trim().min(1, i18n.t(key))

export const registerSchema = z.object({
  tenant_name: required('register.errors.tenant_name'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, i18n.t('register.errors.slug'))
    .min(3, i18n.t('register.errors.slug'))
    .max(30, i18n.t('register.errors.slug')),
  shop_name: required('register.errors.shop_name'),
  shop_city: required('register.errors.shop_city'),
  firstname: required('register.errors.firstname'),
  lastname: required('register.errors.lastname'),
  phone: z
    .string()
    .trim()
    .refine((v) => /^0\d{9}$/.test(v.replace(/[\s.-]/g, '').replace(/^\+225/, '')), i18n.t('register.errors.phone')),
  email: z.email(i18n.t('register.errors.email')),
  password: z.string().min(6, i18n.t('register.errors.password')),
  plan_id: z.number({ error: i18n.t('register.errors.plan_id') }),
})

export type RegisterForm = z.infer<typeof registerSchema>

/** Champs de chaque étape de l'inscription, pour valider l'étape avant de passer à la suivante. */
export const REGISTER_STEPS = [
  { id: 'business', fields: ['tenant_name', 'slug', 'shop_name', 'shop_city'] },
  { id: 'owner', fields: ['firstname', 'lastname', 'phone', 'email', 'password'] },
  { id: 'plan', fields: ['plan_id'] },
] as const satisfies readonly { id: string; fields: readonly (keyof RegisterForm)[] }[]

/** « Alimentation Koné & Fils » → « alimentation-kone-fils » */
export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '')
}
