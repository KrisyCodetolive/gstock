import { z } from 'zod'
import i18n from '@/lib/i18n'
import type { Product, ProductCreatePayload, ProductType } from '@/types/catalog'

/** Nombre saisi au clavier, virgule acceptée ; vide autorisé si facultatif. */
const decimal = (required: boolean, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => (v === '' ? !required : Number(v.replace(',', '.')) >= 0 && !Number.isNaN(Number(v.replace(',', '.')))), message)

export const productSchema = z.object({
  name: z.string().trim().min(1, i18n.t('products.form.required_name')),
  price: decimal(true, i18n.t('products.form.required_price')),
  category_id: z.string(),
  cost: decimal(false, i18n.t('products.form.invalid_number')),
  unit_id: z.string(),
  purchase_unit_id: z.string(),
  barcode: z.string().trim(),
  code: z.string().trim(),
  stock_alert: decimal(false, i18n.t('products.form.invalid_number')),
  initial_quantity: decimal(false, i18n.t('products.form.invalid_number')),
  type: z.enum(['simple', 'service']),
  tax_rate: decimal(false, i18n.t('products.form.invalid_number')),
  brand_id: z.string(),
})

export type ProductForm = z.infer<typeof productSchema>

export const PRODUCT_FIELDS = [
  'name', 'price', 'category_id', 'cost', 'unit_id', 'purchase_unit_id', 'barcode', 'code', 'stock_alert', 'initial_quantity', 'type', 'tax_rate', 'brand_id',
] as const

const trimNumber = (v: string | null) => (v === null ? '' : String(Number(v)))

export function productToForm(p?: Product): ProductForm {
  return {
    name: p?.name ?? '',
    price: p ? trimNumber(p.price) : '',
    category_id: p?.category ? String(p.category.id) : '',
    cost: p ? trimNumber(p.cost) : '',
    unit_id: p ? String(p.unit.id) : '',
    purchase_unit_id: p?.purchase_unit ? String(p.purchase_unit.id) : '',
    barcode: p?.barcode ?? '',
    code: p?.code ?? '',
    stock_alert: p ? trimNumber(p.stock_alert) : '',
    initial_quantity: '',
    type: p?.type === 'service' ? 'service' : 'simple',
    tax_rate: p ? trimNumber(p.tax_rate) : '',
    brand_id: p?.brand ? String(p.brand.id) : '',
  }
}

const dec = (v: string) => (v === '' ? null : v.replace(',', '.'))
const id = (v: string) => (v === '' ? null : Number(v))

export function formToPayload(v: ProductForm, product?: Product, shopId?: number): ProductCreatePayload {
  return {
    type: v.type as ProductType,
    name: v.name,
    code: v.code || null,
    barcode: v.barcode || null,
    category_id: id(v.category_id),
    brand_id: id(v.brand_id),
    unit_id: id(v.unit_id),
    purchase_unit_id: v.type === 'service' ? null : id(v.purchase_unit_id),
    cost: dec(v.cost),
    price: dec(v.price)!,
    tax_rate: dec(v.tax_rate),
    stock_alert: dec(v.stock_alert),
    is_active: product?.is_active ?? true,
    ...(product ? {} : { initial_quantity: dec(v.initial_quantity), shop_id: shopId }),
  }
}
