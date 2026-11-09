import { PackagePlus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection, SwitchField } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { QuantityInput } from '@/components/QuantityInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCan, useSession } from '@/features/auth/hooks'
import { ProductPicker } from '@/features/products/components/ProductPicker'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { useReferentialList } from '@/features/referentials/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { ApiError } from '@/lib/api/client'
import { articleKey } from '@/lib/articles'
import { formatQuantity } from '@/lib/format'
import { apiErrorMessage } from '@/lib/form-errors'
import type { ProductSearchResult } from '@/types/catalog'
import { SupplierSelect } from '../components/SupplierSelect'
import { useCreatePurchase, usePurchaseQuote } from '../hooks'

interface Line {
  product: ProductSearchResult
  /** Unité de la ligne : l'unité d'achat du produit par défaut. */
  unitId: number
  quantity: string
  /** Prix d'une unité de la ligne (un carton, par exemple). */
  cost: string
  /** Produit suivi : date de péremption de l'arrivage, facultative (§7.11). */
  expiry: string
}

/** Prix d'achat proposé pour une unité : prix par unité de base × contenu de l'unité. */
function suggestedCost(product: ProductSearchResult, unitId: number): string {
  const factor = Number(product.units.find((u) => u.id === unitId)?.factor ?? 1)
  return product.cost ? String(Math.round(Number(product.cost) * factor * 100) / 100) : ''
}

/** Une ligne par article : produit, ou variante d'un produit à variantes. */
const keyOf = (l: Line) => articleKey(l.product.id, l.product.variant_id)

function newLine(product: ProductSearchResult): Line {
  const unitId = product.purchase_unit_id ?? product.unit.id
  return { product, unitId, quantity: '1', cost: suggestedCost(product, unitId), expiry: '' }
}

const clean = (v: string) => v.replace(/\s/g, '').replace(',', '.')

/** Approvisionnement AP-N (M11) : le stock augmente dès l'enregistrement. */
export function PurchaseFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const can = useCan()
  const { tenant } = useSession()
  const { shop } = useCurrentShop()
  const create = useCreatePurchase(shop?.id)
  const methods = useReferentialList('payment-methods', { per_page: 100, filter: { is_active: 'true' } })
  const [lines, setLines] = useState<Line[]>([])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [discount, setDiscount] = useState('')
  const [updateCosts, setUpdateCosts] = useState(true)
  const [paid, setPaid] = useState('')
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [picker, setPicker] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const validLines = lines.every((l) => Number(clean(l.quantity)) > 0 && clean(l.cost) !== '' && Number(clean(l.cost)) >= 0)
  const input = lines.length
    ? {
        items: lines.map((l) => ({ product_id: l.product.id, ...(l.product.variant_id ? { variant_id: l.product.variant_id } : {}), unit_id: l.unitId, quantity: clean(l.quantity), cost: clean(l.cost) || '0', ...(l.product.track_expiry && l.expiry ? { expiry_date: l.expiry } : {}) })),
        ...(discount ? { discount: clean(discount) } : {}),
      }
    : null
  const quote = usePurchaseQuote(shop?.id, validLines ? input : null)
  const quoteError = quote.error instanceof ApiError ? apiErrorMessage(quote.error) : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (lines.length === 0 || !validLines || !input) return
    const paidValue = Number(clean(paid)) || 0
    create.mutate(
      {
        ...input,
        supplier_id: supplierId,
        occurred_at: date ? new Date(`${date}T12:00:00Z`).toISOString() : undefined,
        update_costs: updateCosts,
        note: note || null,
        ...(paidValue > 0 ? { paid_amount: String(paidValue), payment_method_id: method ? Number(method) : null } : {}),
      },
      {
        onSuccess: (p) => {
          toast.success(t('purchases.form.done', { reference: p.reference }))
          navigate(`/approvisionnements/${p.id}`, { replace: true })
        },
        onError: (err) => setServerError(apiErrorMessage(err)),
      },
    )
  }

  const update = (k: string, changes: Partial<Line>) => setLines((ls) => ls.map((l) => (keyOf(l) === k ? { ...l, ...changes } : l)))

  return (
    <div className="grid gap-6">
      <BackLink to="/approvisionnements" label={t('purchases.back')} />
      <PageHeader title={t('purchases.form.title')} subtitle={t('purchases.form.intro', { shop: shop?.name ?? '' })} />
      <form onSubmit={submit} noValidate className="grid gap-5">
        {serverError && <FormAlert>{serverError}</FormAlert>}

        <FormSection title={t('purchases.form.supplier')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SupplierSelect id="purchase-supplier" value={supplierId} onChange={setSupplierId} />
            <FormField id="purchase-date" label={t('purchases.form.date')} optional>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('purchases.form.products')}>
          {lines.length > 0 && (
            <ul className="grid gap-3">
              {lines.map((l) => {
                const k = keyOf(l)
                const q = quote.data?.items.find((i) => articleKey(i.product_id, i.variant_id) === k)
                const unit = l.product.units.find((u) => u.id === l.unitId) ?? l.product.unit
                return (
                  <li key={k} className="grid gap-3 rounded-md border-2 border-foreground p-3">
                    <div className="flex items-center gap-3">
                      <ProductThumb name={l.product.name} color={l.product.category?.color} imageUrl={l.product.image_url} className="size-10" />
                      <span className="min-w-0 flex-1 truncate font-bold">{l.product.name}</span>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((ls) => ls.filter((x) => keyOf(x) !== k))} aria-label={t('purchases.form.remove', { name: l.product.name })}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    {/* Unités multiples : mode avancé (§7.3), ou produit qui a déjà une unité d'achat. */}
                    {l.product.units.length > 1 && (tenant.advanced_mode || l.product.purchase_unit_id !== null) && (
                      <div className="grid gap-1">
                        <label htmlFor={`purchase-unit-${k}`} className="text-sm font-semibold">
                          {t('purchases.form.unit')}
                        </label>
                        <Select
                          value={String(l.unitId)}
                          onValueChange={(v) => update(k, { unitId: Number(v), cost: suggestedCost(l.product, Number(v)) })}
                        >
                          <SelectTrigger id={`purchase-unit-${k}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {l.product.units.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.id === l.product.unit.id
                                  ? u.name
                                  : t('purchases.form.unit_option', { name: u.name, qty: formatQuantity(u.factor), base: l.product.unit.short_name })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
                      <div className="grid gap-1">
                        <span className="text-sm font-semibold">
                          {t('purchases.form.quantity')} ({unit.short_name})
                        </span>
                        <QuantityInput id={`purchase-qty-${k}`} value={l.quantity} onChange={(v) => update(k, { quantity: v })} label={`${t('purchases.form.quantity')} — ${l.product.name}`} />
                      </div>
                      <FormField id={`purchase-cost-${k}`} label={t('purchases.form.cost_per', { unit: unit.short_name })}>
                        <Input inputMode="numeric" className="tabular" value={l.cost} onChange={(e) => update(k, { cost: e.target.value })} />
                      </FormField>
                    </div>
                    {l.product.track_expiry && (
                      <FormField id={`purchase-expiry-${k}`} label={t('stock.expiry.date')} optional hint={t('stock.expiry.date_hint')}>
                        <Input type="date" value={l.expiry} onChange={(e) => update(k, { expiry: e.target.value })} />
                      </FormField>
                    )}
                    {q && (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {t('purchases.form.subtotal', { amount: Number(q.subtotal).toLocaleString('fr-FR') })}
                        {q.unit.id !== l.product.unit.id &&
                          ` · ${t('purchases.form.base_quantity', { qty: formatQuantity(q.base_quantity), unit: l.product.unit.short_name })}`}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <Button type="button" variant="outline" className="justify-self-start" onClick={() => setPicker(true)}>
            <PackagePlus aria-hidden="true" />
            {t('purchases.form.add_product')}
          </Button>
          {submitted && lines.length === 0 && <FieldError>{t('purchases.form.no_lines')}</FieldError>}
          {submitted && lines.length > 0 && !validLines && <FieldError>{t('purchases.form.invalid_line')}</FieldError>}
          {lines.length > 0 && (
            <SwitchField id="update-costs" label={t('purchases.form.update_costs')} hint={t('purchases.form.update_costs_hint')} checked={updateCosts} onCheckedChange={setUpdateCosts} />
          )}
        </FormSection>

        {lines.length > 0 && (
          <FormSection title={t('purchases.form.total')}>
            <FormField id="purchase-discount" label={t('purchases.form.discount')} optional>
              <Input inputMode="numeric" className="tabular" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </FormField>
            {quoteError && <FormAlert>{quoteError}</FormAlert>}
            <div className="flex items-end justify-between gap-2" aria-live="polite">
              <span className="font-semibold">{t('purchases.form.total')}</span>
              <Money value={quote.data?.total ?? '0'} size="lg" className={quote.isFetching ? 'opacity-50' : undefined} />
            </div>
          </FormSection>
        )}

        {lines.length > 0 && can('purchase_payments.create') && (
          <FormSection title={t('purchases.form.payment')} description={t('purchases.form.paid_hint')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <FormField id="purchase-paid" label={t('purchases.form.paid_amount')} optional>
                  <Input inputMode="numeric" className="tabular text-lg font-bold" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </FormField>
                {quote.data && (
                  <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setPaid(String(Number(quote.data.total)))}>
                    {t('purchases.form.pay_all')}
                  </Button>
                )}
              </div>
              <div className="grid content-start gap-2">
                <label htmlFor="purchase-method" className="text-sm font-semibold">
                  {t('purchases.form.method')}
                </label>
                <Select value={method || undefined} onValueChange={setMethod}>
                  <SelectTrigger id="purchase-method">
                    <SelectValue placeholder={t('sales.pos.method')} />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.data?.data.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FormField id="purchase-note" label={t('purchases.form.note')} optional>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
          </FormSection>
        )}

        <FormActions>
          <Button type="button" variant="outline" disabled={create.isPending} onClick={() => navigate('/approvisionnements')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={create.isPending}>
            {create.isPending ? t('common.saving') : t('purchases.form.submit')}
          </Button>
        </FormActions>
      </form>

      <ProductPicker
        open={picker}
        onOpenChange={setPicker}
        exclude={lines.map(keyOf)}
        allowCreate
        onPick={(product) => setLines((ls) => [...ls, newLine(product)])}
      />
    </div>
  )
}
