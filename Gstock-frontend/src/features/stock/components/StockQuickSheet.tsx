import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { QuantityInput } from '@/components/QuantityInput'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDay, formatQuantity } from '@/lib/format'
import type { Id } from '@/types/api'
import type { Product, ProductShopStock } from '@/types/catalog'
import type { AdjustmentKind, StockLot } from '@/types/stock'
import { useCreateAdjustment } from '../hooks'
import { ADJUSTMENT_REASONS, EXIT_REASON, expiryOrNull } from '../reasons'

const parse = (v: string) => Number(v.replace(',', '.'))

/**
 * Mouvement de stock d'un seul produit depuis sa fiche, sans passer par « Mon stock » :
 * ajout, retrait ou correction après comptage. Même endpoint que les mouvements MS-N (M07).
 * Avec `lot` : retrait d'un arrivage précis (produits périmés, §7.11).
 */
export function StockQuickSheet({
  kind,
  onClose,
  product,
  shop,
  stock,
  lot = null,
}: {
  /** null : panneau fermé. */
  kind: AdjustmentKind | null
  onClose: () => void
  product: Product
  shop: { id: Id; name: string }
  stock: ProductShopStock
  lot?: (StockLot & { variant_id: Id | null }) | null
}) {
  const { t } = useTranslation()
  return (
    <ResponsiveSheet
      open={kind !== null}
      onOpenChange={(open) => !open && onClose()}
      title={kind ? t(`products.stock_actions.${kind}`) : ''}
      description={`${product.name} · ${shop.name}`}
    >
      {/* Remonté à chaque ouverture : le formulaire repart de zéro et reçoit un nouvel identifiant d'envoi. */}
      {kind && <QuickForm key={`${kind}-${lot?.id ?? ''}`} kind={kind} onDone={onClose} product={product} shop={shop} stock={stock} lot={lot} />}
    </ResponsiveSheet>
  )
}

function QuickForm({
  kind,
  onDone,
  product,
  shop,
  stock,
  lot,
}: {
  kind: AdjustmentKind
  onDone: () => void
  product: Product
  shop: { id: Id; name: string }
  stock: ProductShopStock
  lot: (StockLot & { variant_id: Id | null }) | null
}) {
  const { t } = useTranslation()
  const create = useCreateAdjustment(shop.id)
  // Idempotence : un double appui n'enregistre qu'un mouvement (ADR-005).
  const [offlineUuid] = useState(() => crypto.randomUUID())
  const variants = stock.variants
  const [variantId, setVariantId] = useState(lot?.variant_id ? String(lot.variant_id) : variants.length === 1 ? String(variants[0]!.id) : '')
  const variant = variants.find((v) => String(v.id) === variantId)
  // Retrait d'un arrivage : on ne peut pas prendre plus que ce qu'il contient.
  const current = Number(lot ? lot.quantity : product.type === 'variable' ? (variant?.quantity ?? 0) : stock.quantity)
  const [value, setValue] = useState(kind === 'inventory' || lot ? String(current) : '1')
  const [reasonKey, setReasonKey] = useState(lot ? 'exit_expired' : ADJUSTMENT_REASONS[kind][0]!)
  // Produit suivi : date de l'arrivage créé par une entrée, ou par un inventaire qui ajoute (§7.11).
  const withDate = Boolean(product.track_expiry) && kind !== 'exit'
  const [expiry, setExpiry] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const unit = product.unit.short_name
  const reason = reasonKey === 'other' ? otherReason.trim() : t(`stock.form.reasons.${reasonKey}` as 'stock.form.reasons.other')
  const n = parse(value)

  // Contrôles de saisie avant envoi ; le serveur reste juge (stock jamais négatif, §7.2).
  const errors = {
    variant: product.type === 'variable' && !variant ? t('products.stock_actions.variant_required') : null,
    quantity:
      kind === 'inventory'
        ? value.trim() === '' || !(n >= 0)
          ? t('stock.form.invalid_counted')
          : null
        : !(n > 0)
          ? t('stock.form.invalid_quantity')
          : kind === 'exit' && n > current
            ? t('stock.form.exceeds', { value: `${formatQuantity(current)} ${unit}` })
            : null,
    reason: reason === '' ? t('stock.form.required_reason') : null,
  }
  const show = (error: string | null) => (submitted ? (error ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (errors.variant || errors.quantity || errors.reason) return
    const item = {
      product_id: product.id,
      ...(variant ? { variant_id: variant.id } : {}),
      ...(withDate ? { expiry_date: expiryOrNull(expiry) } : {}),
      ...(lot ? { stock_lot_id: lot.id } : {}),
    }
    create.mutate(
      {
        kind,
        reason,
        ...(kind === 'exit' ? { exit_reason: EXIT_REASON[reasonKey] ?? 'other' } : {}),
        offline_uuid: offlineUuid,
        items: [kind === 'inventory' ? { ...item, counted_quantity: String(n) } : { ...item, quantity: String(n) }],
      },
      {
        onSuccess: (adjustment) => {
          toast.success(t('stock.form.done', { reference: adjustment.reference }))
          onDone()
        },
        onError: (error) => setServerError(apiErrorMessage(error)),
      },
    )
  }

  const gap = n - current

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {serverError && <FormAlert>{serverError}</FormAlert>}

      {lot && (
        <p className="rounded-md border-2 border-foreground bg-muted px-3 py-2 font-semibold">
          {lot.expiry_date
            ? t('stock.expiry.lot_line', { value: `${formatQuantity(lot.quantity)} ${product.unit.short_name}`, date: formatDay(lot.expiry_date) })
            : t('stock.expiry.lot_undated', { value: `${formatQuantity(lot.quantity)} ${product.unit.short_name}` })}
        </p>
      )}

      {product.type === 'variable' && !lot && (
        <div className="grid gap-2">
          <span className="font-semibold">{t('products.stock_actions.variant')}</span>
          <Select
            value={variantId}
            onValueChange={(id) => {
              setVariantId(id)
              if (kind === 'inventory') setValue(String(Number(variants.find((v) => String(v.id) === id)?.quantity ?? 0)))
            }}
          >
            <SelectTrigger aria-label={t('products.stock_actions.variant')} aria-invalid={Boolean(show(errors.variant))}>
              <SelectValue placeholder={t('products.stock_actions.variant_required')} />
            </SelectTrigger>
            <SelectContent>
              {variants.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {`${v.name} · ${formatQuantity(v.quantity)} ${unit}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {show(errors.variant) && <FieldError>{errors.variant}</FieldError>}
        </div>
      )}

      <div className="grid gap-2">
        <label htmlFor="quick-qty" className="font-semibold">
          {`${kind === 'inventory' ? t('stock.form.counted') : t('stock.form.quantity')} (${unit})`}
        </label>
        <QuantityInput
          id="quick-qty"
          value={value}
          onChange={setValue}
          label={kind === 'inventory' ? t('stock.form.counted') : t('stock.form.quantity')}
          invalid={Boolean(show(errors.quantity))}
          describedBy={show(errors.quantity) ? 'quick-qty-error' : undefined}
        />
        <p className="text-sm text-muted-foreground">
          {lot
            ? t('stock.form.in_stock', { value: `${formatQuantity(current)} ${unit}` })
            : t('products.stock_actions.current', { shop: shop.name, value: `${formatQuantity(current)} ${unit}` })}
          {kind === 'inventory' && value.trim() !== '' && n >= 0 && (
            <span className="ml-2 font-bold">
              {gap === 0 ? t('stock.form.gap_none') : t('stock.form.gap', { value: `${gap > 0 ? '+' : '−'}${formatQuantity(Math.abs(gap))}` })}
            </span>
          )}
        </p>
        {show(errors.quantity) && <FieldError id="quick-qty-error">{errors.quantity}</FieldError>}
      </div>

      {withDate && (
        <FormField id="quick-expiry" label={t('stock.expiry.date')} optional hint={t('stock.expiry.date_hint')}>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </FormField>
      )}

      <div className="grid gap-2">
        <span className="font-semibold">{t('stock.form.reason')}</span>
        <Select value={reasonKey} onValueChange={setReasonKey}>
          <SelectTrigger aria-label={t('stock.form.reason')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADJUSTMENT_REASONS[kind].map((key) => (
              <SelectItem key={key} value={key}>
                {t(`stock.form.reasons.${key}` as 'stock.form.reasons.other')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {reasonKey === 'other' && (
          <FormField id="quick-other-reason" label={t('stock.form.reason_other')} error={show(errors.reason)}>
            <Input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
          </FormField>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={create.isPending} onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? t('common.saving') : t(`stock.form.submit_${kind}`)}
        </Button>
      </div>
    </form>
  )
}
