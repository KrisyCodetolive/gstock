import { z } from 'zod'
import i18n from '@/lib/i18n'

export const loginSchema = z.object({
  login: z.string().trim().min(1, i18n.t('auth.required_login')),
  password: z.string().min(1, i18n.t('auth.required_password')),
})

export type LoginForm = z.infer<typeof loginSchema>
