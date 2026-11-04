import { z } from 'zod'
import i18n from '@/lib/i18n'

export const loginSchema = z.object({
  login: z.string().trim().min(1, i18n.t('auth.required_login')),
  password: z.string().min(1, i18n.t('auth.required_password')),
})

export type LoginForm = z.infer<typeof loginSchema>

export const forgotSchema = z.object({
  email: z.email(i18n.t('auth.forgot.invalid_email')),
})

export type ForgotForm = z.infer<typeof forgotSchema>

/** Nouveau mot de passe saisi deux fois (réinitialisation et changement). */
const newPassword = {
  password: z.string().min(8, i18n.t('auth.reset.short_password')),
  password_confirmation: z.string(),
}
const sameAsPassword = (v: { password: string; password_confirmation: string }) => v.password === v.password_confirmation
const mismatch = { path: ['password_confirmation'], message: i18n.t('auth.reset.mismatch') }

export const resetSchema = z.object(newPassword).refine(sameAsPassword, mismatch)
export type ResetForm = z.infer<typeof resetSchema>

export const passwordChangeSchema = z
  .object({ current_password: z.string().min(1, i18n.t('profile.password.required_current')), ...newPassword })
  .refine(sameAsPassword, mismatch)
export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>

export const profileSchema = z
  .object({
    firstname: z.string().trim().min(1, i18n.t('profile.required_firstname')),
    lastname: z.string().trim().min(1, i18n.t('profile.required_lastname')),
    email: z
      .string()
      .trim()
      .refine((v) => v === '' || z.email().safeParse(v).success, i18n.t('auth.forgot.invalid_email')),
    phone: z.string().trim(),
  })
  .refine((v) => v.email !== '' || v.phone !== '', { path: ['email'], message: i18n.t('profile.required_login') })
export type ProfileForm = z.infer<typeof profileSchema>
