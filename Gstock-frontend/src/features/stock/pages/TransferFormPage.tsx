import { PackagePlus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { QuantityInput } from '@/components/QuantityInput'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/features/auth/hooks'
import { ProductPicker } from '@/features/products/components/ProductPicker'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { useCurrentShop } from '@/features/shops/hooks'
import { articleKey } from '@/lib/articles'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatQuantity } from '@/lib/format'
import type { ProductSearchResult } from '@/types/catalog'
import { useSendTransfer } from '../hooks'

interface Line {
  product: ProductSearchResult
  value: string
}

const parse = (v: string) => Number(v.replace(',', '.'))
const keyOf = (l: Line) => articleKey(l.product.id, l.product.variant_id)

/** Envoi de marchandise vers une autre boutique (§7.12) : le stock sort tout de suite. */
export function TransferFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { shops } = useSession()
  const { shop } = useCurrentShop()
  const send = useSendTransfer(shop?.id)
  const destinations = shops.filter((s) => s.id !== shop?.id)
  const [toShop, setToShop] = useState(destinations.length === 1 ? String(destinations[0]!.id) : '')
  const [lines, setLines] = useState<Line[]>([])
  const [note, setNote] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Contrôles de saisie avant envoi ; le serveur reste juge (stock jamais négatif, §7.2).
  const lineError = (l: Line): string | null => {
    const n = parse(l.value)
    if (!(n > 0)) return t('stock.form.invalid_quantity')
    if (l.product.quantity !== null && n > Number(l.product.quantity)) {
      return t('stock.form.exceeds', { value: `${formatQuantity(l.product.quantity)} ${l.product.unit.short_name}` })
    }
    return null
  }
  const errors = {
    toShop: toShop === '' ? t('stock.transfers.form.required_to_shop') : null,
    lines: lines.length === 0 ? t('stock.form.no_lines') : null,
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (errors.toShop || errors.lines || lines.some(lineError)) return
    send.mutate(
      {
        to_shop_id: Number(toShop),
        note: note.trim() || null,
        items: lines.map((l) => ({ product_id: l.product.id, ...(l.product.variant_id ? { variant_id: l.product.variant_id } : {}), quantity: String(parse(l.value)) })),
      },
      {
        onSuccess: (transfer) => {
          toast.success(t('stock.transfers.form.done', { reference: transfer.reference, shop: transfer.to_shop.name }))
          navigate(`/stock/transferts/${transfer.id}`, { replace: true })
        },
        onError: (error) => setServerError(apiErrorMessage(error)),
      },
    )
  }

  if (destinations.length === 0) {
    return (
      <div className="grid gap-6">
        <BackLink to="/stock/transferts" label={t('stock.transfers.back')} />
        <EmptyState title={t('stock.transfers.form.no_other_shop')} />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <BackLink to="/stock/transferts" label={t('stock.transfers.back')} />
      <PageHeader title={t('stock.transfers.form.title')} subtitle={t('stock.transfers.form.intro', { shop: shop?.name ?? '' })} />

      <form onSubmit={submit} noValidate className="grid gap-5">
        {serverError && <FormAlert>{serverError}</FormAlert>}

        <FormSection title={t('stock.transfers.form.to_shop')}>
          <Select value={toShop} onValueChange={setToShop}>
            <SelectTrigger aria-label={t('stock.transfers.form.to_shop')} aria-invalid={submitted && errors.toShop ? true : undefined}>
              <SelectValue placeholder={t('stock.transfers.form.to_shop_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {destinations.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {submitted && errors.toShop && <FieldError>{errors.toShop}</FieldError>}
        </FormSection>

        <FormSection title={t('stock.form.products')} description={lines.length ? t('stock.form.lines', { count: lines.length }) : undefined}>
          {lines.length > 0 && (
            <ul className="grid gap-3">
              {lines.map((line) => {
                const k = keyOf(line)
                const error = submitted ? lineError(line) : null
                return (
                  <li key={k} className="grid gap-3 rounded-md border-2 border-foreground p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex items-center gap-3">
                      <ProductThumb name={line.product.name} color={line.product.category?.color} imageUrl={line.product.image_url} className="size-10" />
                      <div className="grid min-w-0 flex-1">
                        <span className="truncate font-bold">{line.product.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {t('stock.form.in_stock', { value: `${formatQuantity(line.product.quantity ?? 0)} ${line.product.unit.short_name}` })}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLines((ls) => ls.filter((l) => keyOf(l) !== k))}
                        aria-label={t('stock.form.remove_line', { name: line.product.name })}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="grid gap-1">
                      <QuantityInput
                        id={`qty-${k}`}
                        value={line.value}
                        onChange={(value) => setLines((ls) => ls.map((l) => (keyOf(l) === k ? { ...l, value } : l)))}
                        label={`${t('stock.form.quantity')} — ${line.product.name}`}
                        invalid={Boolean(error)}
                        describedBy={error ? `qty-${k}-error` : undefined}
                      />
                      {error && <FieldError id={`qty-${k}-error`}>{error}</FieldError>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Button type="button" variant="outline" className="justify-self-start" onClick={() => setPickerOpen(true)}>
            <PackagePlus aria-hidden="true" />
            {t('stock.form.add_product')}
          </Button>
          {submitted && errors.lines && <FieldError>{errors.lines}</FieldError>}
        </FormSection>

        <FormSection title={t('stock.transfers.form.note')}>
          <FormField id="transfer-note" label={t('stock.transfers.form.note')} optional className="[&>label]:sr-only">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" disabled={send.isPending} onClick={() => navigate('/stock/transferts')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={send.isPending}>
            {send.isPending ? t('common.saving') : t('stock.transfers.form.submit')}
          </Button>
        </FormActions>
      </form>

      <ProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        exclude={lines.map(keyOf)}
        onPick={(product) => setLines((ls) => [...ls, { product, value: '1' }])}
      />
    </div>
  )
}
