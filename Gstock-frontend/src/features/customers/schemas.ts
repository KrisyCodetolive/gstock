import { z } from 'zod'
import i18n from '@/lib/i18n'
import type { Customer, CustomerPayload } from '@/types/customers'

export const customerSchema = z.object({
  name: z.string().trim().min(1, i18n.t('customers.form.required_name')),
  phone: z.string().trim(),
  district: z.string().trim(),
  note: z.string().trim(),
})

export type CustomerForm = z.infer<typeof customerSchema>

export const CUSTOMER_FIELDS = ['name', 'phone', 'district', 'note'] as const

export const customerToForm = (c?: Customer | null): CustomerForm => ({
  name: c?.name ?? '',
  phone: c?.phone ?? '',
  district: c?.district ?? '',
  note: c?.note ?? '',
})

export const formToCustomer = (v: CustomerForm, isActive = true): CustomerPayload => ({
  name: v.name,
  phone: v.phone || null,
  district: v.district || null,
  note: v.note || null,
  is_active: isActive,
})
