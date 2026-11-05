import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FieldError, FormField } from '@/components/FormField'
import { FormSection } from '@/components/FormLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { emptyVariant, type ProductForm } from '../schemas'

/** Création : stock de départ de chaque nouvelle variante dans la boutique courante. */
export interface VariantStockOptions {
  shopName: string
  unit: string
  trackExpiry: boolean
}

/**
 * Variantes d'un produit (mode avancé) : nom, prix, prix d'achat, code-barres.
 * Une variante enregistrée ne se retire pas, elle se met « hors vente ».
 */
export function VariantsEditor({
  control,
  register,
  errors,
  stock = null,
}: {
  control: Control<ProductForm>
  register: UseFormRegister<ProductForm>
  errors: FieldErrors<ProductForm>
  stock?: VariantStockOptions | null
}) {
  const { t } = useTranslation()
  const { fields, append, remove, update } = useFieldArray({ control, name: 'variants', keyName: 'key' })

  return (
    <FormSection title={t('products.variants.title')} description={t('products.variants.hint')}>
      <ul className="grid gap-3">
        {fields.map((field, i) => {
          const e = errors.variants?.[i]
          return (
            <li key={field.key} className="grid gap-3 rounded-md border-2 border-foreground p-3">
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <FormField id={`variant-name-${i}`} label={t('products.variants.name')} error={e?.name?.message}>
                  <Input placeholder={t('products.variants.name_placeholder')} {...register(`variants.${i}.name`)} />
                </FormField>
                <FormField id={`variant-price-${i}`} label={t('products.variants.price')} error={e?.price?.message}>
                  <Input inputMode="numeric" className="tabular font-bold" {...register(`variants.${i}.price`)} />
                </FormField>
                <FormField id={`variant-cost-${i}`} label={t('products.variants.cost')} optional error={e?.cost?.message}>
                  <Input inputMode="numeric" className="tabular" {...register(`variants.${i}.cost`)} />
                </FormField>
              </div>
              {stock && !field.id && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    id={`variant-qty-${i}`}
                    label={`${t('products.form.initial_quantity')} (${stock.unit})`}
                    optional
                    hint={t('products.variants.initial_hint', { shop: stock.shopName })}
                    error={e?.initial_quantity?.message}
                  >
                    <Input inputMode="decimal" className="tabular" {...register(`variants.${i}.initial_quantity`)} />
                  </FormField>
                  {stock.trackExpiry && (
                    <FormField id={`variant-expiry-${i}`} label={t('products.form.initial_expiry_date')} optional>
                      <Input type="date" {...register(`variants.${i}.initial_expiry_date`)} />
                    </FormField>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <FormField id={`variant-barcode-${i}`} label={t('products.variants.barcode')} optional className="min-w-48 flex-1">
                  <Input inputMode="numeric" className="tabular" {...register(`variants.${i}.barcode`)} />
                </FormField>
                {field.id ? (
                  <label className="flex min-h-12 items-center gap-3 font-semibold">
                    <Switch checked={field.is_active} onCheckedChange={(checked) => update(i, { ...field, is_active: checked })} />
                    {t('products.variants.active')}
                  </label>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => remove(i)}>
                    <Trash2 aria-hidden="true" />
                    {t('products.variants.remove')}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {errors.variants?.root?.message && <FieldError>{errors.variants.root.message}</FieldError>}
      {errors.variants?.message && <FieldError>{errors.variants.message}</FieldError>}
      <Button type="button" variant="outline" className="justify-self-start" onClick={() => append(emptyVariant())}>
        <Plus aria-hidden="true" />
        {t('products.variants.add')}
      </Button>
    </FormSection>
  )
}
