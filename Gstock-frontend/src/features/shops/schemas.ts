import { z } from 'zod'
import i18n from '@/lib/i18n'
import type { Shop, ShopPayload } from '@/types/settings'

export const shopSchema = z.object({
  name: z.string().trim().min(1, i18n.t('shops.form.required_name')),
  city: z.string().trim().min(1, i18n.t('shops.form.required_city')),
  district: z.string().trim(),
  address: z.string().trim(),
  phone: z.string().trim(),
  receipt_note: z.string().trim(),
  receipt_show_customer: z.boolean(),
  receipt_show_phone: z.boolean(),
  auto_print_receipt: z.boolean(),
})

export type ShopForm = z.infer<typeof shopSchema>

export const SHOP_FIELDS = ['name', 'city', 'district', 'address', 'phone', 'receipt_note'] as const

export function shopToForm(shop?: Shop): ShopForm {
  return {
    name: shop?.name ?? '',
    city: shop?.city ?? 'Abidjan',
    district: shop?.district ?? '',
    address: shop?.address ?? '',
    phone: shop?.phone ?? '',
    receipt_note: shop?.receipt_note ?? '',
    receipt_show_customer: shop?.receipt_show_customer ?? true,
    receipt_show_phone: shop?.receipt_show_phone ?? true,
    auto_print_receipt: shop?.auto_print_receipt ?? false,
  }
}

export function formToPayload(values: ShopForm, shop?: Shop): ShopPayload {
  return {
    ...values,
    district: values.district || null,
    address: values.address || null,
    phone: values.phone || null,
    receipt_note: values.receipt_note || null,
    default_customer_id: shop?.default_customer_id ?? null,
    is_active: shop?.is_active ?? true,
  }
}
