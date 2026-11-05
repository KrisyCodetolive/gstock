import { z } from 'zod'
import i18n from '@/lib/i18n'
import type { Product, ProductCreatePayload, ProductType } from '@/types/catalog'

/** Nombre saisi au clavier, virgule acceptée ; vide autorisé si facultatif. */
const decimal = (required: boolean, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => (v === '' ? !required : Number(v.replace(',', '.')) >= 0 && !Number.isNaN(Number(v.replace(',', '.')))), message)

const variantSchema = z.object({
  /** Absent : variante pas encore enregistrée. */
  id: z.number().optional(),
  name: z.string().trim(),
  price: z.string().trim(),
  cost: z.string().trim(),
  barcode: z.string().trim(),
  is_active: z.boolean(),
  /** Création : stock de départ de la variante (facultatif) et sa date de péremption. */
  initial_quantity: z.string().trim(),
  initial_expiry_date: z.string(),
})

export type VariantForm = z.infer<typeof variantSchema>

const isNumber = (v: string) => v !== '' && Number(v.replace(',', '.')) >= 0 && !Number.isNaN(Number(v.replace(',', '.')))

export const productSchema = z
  .object({
    name: z.string().trim().min(1, i18n.t('products.form.required_name')),
    /** Produit à variantes : chaque variante a son prix, celui-ci n'est pas saisi. */
    price: z.string().trim(),
    category_id: z.string(),
    cost: decimal(false, i18n.t('products.form.invalid_number')),
    unit_id: z.string(),
    purchase_unit_id: z.string(),
    barcode: z.string().trim(),
    code: z.string().trim(),
    stock_alert: decimal(false, i18n.t('products.form.invalid_number')),
    initial_quantity: decimal(false, i18n.t('products.form.invalid_number')),
    type: z.enum(['simple', 'service', 'variable']),
    tax_rate: decimal(false, i18n.t('products.form.invalid_number')),
    brand_id: z.string(),
    variants: z.array(variantSchema),
    /** Dates de péremption (§7.11) : tout est facultatif. */
    track_expiry: z.boolean(),
    expiry_alert_days: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 365), i18n.t('products.form.invalid_alert_days')),
    initial_expiry_date: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'variable') {
      if (!isNumber(v.price)) ctx.addIssue({ code: 'custom', path: ['price'], message: i18n.t('products.form.required_price') })
      return
    }
    v.variants.forEach((row, i) => {
      if (!row.name) ctx.addIssue({ code: 'custom', path: ['variants', i, 'name'], message: i18n.t('products.variants.required_name') })
      if (!isNumber(row.price)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'price'], message: i18n.t('products.form.required_price') })
      if (row.cost && !isNumber(row.cost)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'cost'], message: i18n.t('products.form.invalid_number') })
      if (row.initial_quantity && !isNumber(row.initial_quantity)) {
        ctx.addIssue({ code: 'custom', path: ['variants', i, 'initial_quantity'], message: i18n.t('products.form.invalid_number') })
      }
    })
    if (!v.variants.some((row) => row.is_active)) ctx.addIssue({ code: 'custom', path: ['variants'], message: i18n.t('products.variants.required_one') })
  })

export type ProductForm = z.infer<typeof productSchema>

export const PRODUCT_FIELDS = [
  'name', 'price', 'category_id', 'cost', 'unit_id', 'purchase_unit_id', 'barcode', 'code', 'stock_alert', 'initial_quantity', 'type', 'tax_rate', 'brand_id', 'variants',
  'track_expiry', 'expiry_alert_days', 'initial_expiry_date',
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
    type: p?.type ?? 'simple',
    tax_rate: p ? trimNumber(p.tax_rate) : '',
    brand_id: p?.brand ? String(p.brand.id) : '',
    track_expiry: p?.track_expiry ?? false,
    expiry_alert_days: p?.expiry_alert_days == null ? '' : String(p.expiry_alert_days),
    initial_expiry_date: '',
    variants: (p?.variants ?? []).map((x) => ({
      id: x.id,
      name: x.name,
      price: trimNumber(x.price),
      cost: trimNumber(x.cost),
      barcode: x.barcode ?? '',
      is_active: x.is_active,
      initial_quantity: '',
      initial_expiry_date: '',
    })),
  }
}

export const emptyVariant = (): VariantForm => ({ name: '', price: '', cost: '', barcode: '', is_active: true, initial_quantity: '', initial_expiry_date: '' })

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
    price: v.type === 'variable' ? '0' : dec(v.price)!,
    tax_rate: dec(v.tax_rate),
    stock_alert: dec(v.stock_alert),
    is_active: product?.is_active ?? true,
    track_expiry: v.type !== 'service' && v.track_expiry,
    expiry_alert_days: v.type !== 'service' && v.track_expiry && v.expiry_alert_days !== '' ? Number(v.expiry_alert_days) : null,
    ...(v.type === 'variable'
      ? {
          variants: v.variants.map((x) => ({
            ...(x.id ? { id: x.id } : {}),
            name: x.name,
            price: dec(x.price)!,
            cost: dec(x.cost),
            barcode: x.barcode || null,
            is_active: x.is_active,
            // Création seulement : le stock d'une variante existante se change depuis sa fiche.
            ...(product || x.id
              ? {}
              : {
                  initial_quantity: dec(x.initial_quantity),
                  initial_expiry_date: v.track_expiry && x.initial_expiry_date !== '' ? x.initial_expiry_date : null,
                }),
          })),
        }
      : {}),
    ...(product
      ? {}
      : {
          initial_quantity: dec(v.initial_quantity),
          initial_expiry_date: v.track_expiry && v.initial_expiry_date !== '' ? v.initial_expiry_date : null,
          shop_id: shopId,
        }),
  }
}
