import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useReferentialList } from '@/features/referentials/hooks'
import { ApiError } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/form-errors'
import type { Product, ProductSearchResult } from '@/types/catalog'
import { useSaveProduct } from '../hooks'

const NONE = 'none'
const clean = (v: string) => v.replace(/\s/g, '').replace(',', '.')
/** Un texte fait seulement de chiffres (8 ou plus) est un code-barres scanné ou tapé. */
const looksLikeBarcode = (v: string) => /^\d{8,}$/.test(v.trim())

/** Le produit créé, sous la forme d'un résultat de recherche : il devient aussitôt une ligne. */
function toSearchResult(p: Product): ProductSearchResult {
  return {
    id: p.id,
    variant_id: null,
    variant_name: null,
    type: p.type,
    name: p.name,
    code: p.code,
    barcode: p.barcode,
    price: p.price,
    cost: p.cost,
    unit: p.unit,
    purchase_unit_id: p.purchase_unit?.id ?? null,
    units: p.units,
    category: p.category,
    image_url: p.image_url,
    quantity: p.stock?.quantity ?? '0',
    state: p.stock?.state ?? null,
    track_expiry: p.track_expiry,
  }
}

/**
 * Création d'un produit simple sans quitter l'approvisionnement ou l'entrée en stock (M06) :
 * nom, prix de vente, catégorie et unité facultatives. Aucune quantité de départ : c'est
 * l'opération en cours qui fait entrer la marchandise (sinon elle serait comptée deux fois).
 * Le reste (photo, prix d'achat, alerte…) se complète sur la fiche.
 */
export function QuickProductForm({ search, onCancel, onCreated }: { search: string; onCancel: () => void; onCreated: (p: ProductSearchResult) => void }) {
  const { t } = useTranslation()
  const save = useSaveProduct()
  const categories = useReferentialList('categories', { per_page: 100, sort: 'name', filter: { is_active: 'true' } })
  const units = useReferentialList('units', { per_page: 100, sort: 'name', filter: { is_active: 'true' } })
  const scanned = looksLikeBarcode(search)
  const [name, setName] = useState(scanned ? '' : search.trim())
  const [barcode, setBarcode] = useState(scanned ? search.trim() : '')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(NONE)
  const [unit, setUnit] = useState(NONE)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [error, setError] = useState<string | null>(null)
  // Seulement les unités de base : une unité dérivée (Carton) se choisit comme unité d'achat sur la fiche.
  const baseUnits = units.data?.data.filter((u) => u.base_unit_id === null) ?? []

  const submit = (e: FormEvent) => {
    // Le panneau s'ouvre depuis un formulaire : ne pas l'envoyer aussi.
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    const local = {
      name: name.trim() ? undefined : t('products.quick.required_name'),
      price: clean(price) !== '' && Number(clean(price)) >= 0 ? undefined : t('products.quick.required_price'),
    }
    setErrors(local)
    if (local.name || local.price) return
    save.mutate(
      {
        type: 'simple',
        name: name.trim(),
        code: null,
        barcode: barcode.trim() || null,
        category_id: category === NONE ? null : Number(category),
        brand_id: null,
        unit_id: unit === NONE ? null : Number(unit),
        purchase_unit_id: null,
        cost: null,
        price: clean(price),
        tax_rate: null,
        stock_alert: null,
        is_active: true,
      },
      {
        onSuccess: (p) => {
          toast.success(t('products.quick.created', { name: p.name }))
          onCreated(toSearchResult(p))
        },
        onError: (err) => {
          const fields = ['name', 'price', 'barcode', 'category_id', 'unit_id']
          if (err instanceof ApiError && fields.some((f) => err.fieldError(f))) {
            setErrors(Object.fromEntries(fields.map((f) => [f, err.fieldError(f)])))
          } else {
            setError(apiErrorMessage(err))
          }
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('products.quick.hint')}</p>
      {error && <FormAlert>{error}</FormAlert>}
      <FormField id="quick-product-name" label={t('products.form.name')} error={errors.name}>
        <Input autoFocus={!scanned || undefined} value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField id="quick-product-price" label={t('products.quick.price')} error={errors.price}>
        <Input inputMode="decimal" autoFocus={scanned || undefined} className="tabular font-bold" value={price} onChange={(e) => setPrice(e.target.value)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="quick-product-category" className="text-sm font-semibold">
            {t('products.form.category')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="quick-product-category" aria-invalid={errors.category_id ? true : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t('products.quick.no_category')}</SelectItem>
              {categories.data?.data.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <label htmlFor="quick-product-unit" className="text-sm font-semibold">
            {t('products.quick.unit')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
          </label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger id="quick-product-unit" aria-invalid={errors.unit_id ? true : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t('products.quick.default_unit')}</SelectItem>
              {baseUnits.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <FormField id="quick-product-barcode" label={t('products.form.barcode')} error={errors.barcode} optional>
        <Input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      </FormField>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="action" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('products.quick.submit')}
        </Button>
      </div>
    </form>
  )
}
