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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductPicker } from '@/features/products/components/ProductPicker'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { useCurrentShop } from '@/features/shops/hooks'
import { ApiError } from '@/lib/api/client'
import { formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductSearchResult } from '@/types/catalog'
import type { AdjustmentKind } from '@/types/stock'
import { useCreateAdjustment } from '../hooks'

const REASONS: Record<AdjustmentKind, string[]> = {
  entry: ['entry_received', 'entry_return', 'entry_found', 'other'],
  exit: ['exit_loss', 'exit_broken', 'exit_expired', 'exit_used', 'other'],
  inventory: ['inventory_count', 'other'],
}

interface Line {
  product: ProductSearchResult
  value: string
}

const parse = (v: string) => Number(v.replace(',', '.'))

/** Entrée, sortie ou inventaire : une référence MS-N par validation (M07). */
export function AdjustmentFormPage({ kind }: { kind: AdjustmentKind }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { shop } = useCurrentShop()
  const create = useCreateAdjustment(shop?.id)
  // Idempotence : un second envoi du même formulaire ne crée pas de doublon (ADR-005).
  const [offlineUuid] = useState(() => crypto.randomUUID())
  const [lines, setLines] = useState<Line[]>([])
  const [reasonKey, setReasonKey] = useState(REASONS[kind][0]!)
  const [otherReason, setOtherReason] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const reason = reasonKey === 'other' ? otherReason.trim() : t(`stock.form.reasons.${reasonKey}` as 'stock.form.reasons.other')

  /** Erreur de saisie d'une ligne, vérifiée avant envoi ; le serveur reste juge. */
  const lineError = (line: Line): string | null => {
    const n = parse(line.value)
    if (kind === 'inventory') return line.value.trim() === '' || !(n >= 0) ? t('stock.form.invalid_counted') : null
    if (!(n > 0)) return t('stock.form.invalid_quantity')
    if (kind === 'exit' && line.product.quantity !== null && n > Number(line.product.quantity)) {
      return t('stock.form.exceeds', { value: `${formatQuantity(line.product.quantity)} ${line.product.unit.short_name}` })
    }
    return null
  }

  const errors = {
    lines: lines.length === 0 ? t('stock.form.no_lines') : null,
    reason: reason === '' ? t('stock.form.required_reason') : null,
  }
  const invalid = Boolean(errors.lines || errors.reason || lines.some(lineError))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (invalid) return
    create.mutate(
      {
        kind,
        reason,
        offline_uuid: offlineUuid,
        items: lines.map((l) =>
          kind === 'inventory'
            ? { product_id: l.product.id, counted_quantity: String(parse(l.value)) }
            : { product_id: l.product.id, quantity: String(parse(l.value)) },
        ),
      },
      {
        onSuccess: (adjustment) => {
          toast.success(t('stock.form.done', { reference: adjustment.reference }))
          navigate(`/stock/operations/${adjustment.id}`, { replace: true })
        },
        onError: (error) =>
          setServerError(error instanceof ApiError ? (Object.values(error.errors)[0]?.[0] ?? error.message) : t('common.generic_error')),
      },
    )
  }

  const update = (id: number, value: string) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, value } : l)))

  return (
    <div className="grid gap-6">
      <BackLink to="/stock" label={t('stock.back')} />
      <PageHeader title={t(`stock.form.${kind}_title`)} subtitle={`${shop?.name ?? ''} · ${t(`stock.form.${kind}_intro`)}`} />

      <form onSubmit={submit} noValidate className="grid gap-5">
        {serverError && <FormAlert>{serverError}</FormAlert>}

        <FormSection title={t('stock.form.products')} description={lines.length ? t('stock.form.lines', { count: lines.length }) : undefined}>
          {lines.length > 0 && (
            <ul className="grid gap-3">
              {lines.map((line) => {
                const error = submitted ? lineError(line) : null
                const id = `qty-${line.product.id}`
                const current = line.product.quantity === null ? 0 : Number(line.product.quantity)
                const gap = parse(line.value) - current
                return (
                  <li key={line.product.id} className="grid gap-3 rounded-md border-2 border-foreground p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex items-center gap-3">
                      <ProductThumb name={line.product.name} color={line.product.category?.color} imageUrl={line.product.image_url} className="size-10" />
                      <div className="grid min-w-0 flex-1">
                        <span className="truncate font-bold">{line.product.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {t('stock.form.in_stock', { value: `${formatQuantity(current)} ${line.product.unit.short_name}` })}
                          {kind === 'inventory' && line.value.trim() !== '' && parse(line.value) >= 0 && (
                            <span className={cn('ml-2 font-bold', gap > 0 && 'text-paid-ink', gap < 0 && 'text-destructive')}>
                              {gap === 0 ? t('stock.form.gap_none') : t('stock.form.gap', { value: `${gap > 0 ? '+' : '−'}${formatQuantity(Math.abs(gap))}` })}
                            </span>
                          )}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLines((ls) => ls.filter((l) => l.product.id !== line.product.id))}
                        aria-label={t('stock.form.remove_line', { name: line.product.name })}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="grid gap-1">
                      <QuantityInput
                        id={id}
                        value={line.value}
                        onChange={(v) => update(line.product.id, v)}
                        label={`${kind === 'inventory' ? t('stock.form.counted') : t('stock.form.quantity')} — ${line.product.name}`}
                        invalid={Boolean(error)}
                        describedBy={error ? `${id}-error` : undefined}
                      />
                      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
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

        <FormSection title={t('stock.form.reason')}>
          <Select value={reasonKey} onValueChange={setReasonKey}>
            <SelectTrigger aria-label={t('stock.form.reason')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS[kind].map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`stock.form.reasons.${key}` as 'stock.form.reasons.other')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reasonKey === 'other' && (
            <FormField id="other_reason" label={t('stock.form.reason_other')} error={submitted ? (errors.reason ?? undefined) : undefined}>
              <Input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
            </FormField>
          )}
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" disabled={create.isPending} onClick={() => navigate('/stock')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={create.isPending}>
            {create.isPending ? t('common.saving') : t(`stock.form.submit_${kind}`)}
          </Button>
        </FormActions>
      </form>

      <ProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={lines.map((l) => l.product.id)}
        onPick={(product) =>
          setLines((ls) => [...ls, { product, value: kind === 'inventory' ? (product.quantity === null ? '0' : String(Number(product.quantity))) : '1' }])
        }
      />
    </div>
  )
}
