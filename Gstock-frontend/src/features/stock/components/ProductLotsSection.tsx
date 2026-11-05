import { CalendarDays, PackageMinus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert, FormField } from '@/components/FormField'
import { FormSection } from '@/components/FormLayout'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCan } from '@/features/auth/hooks'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDateTime, formatDay, formatQuantity } from '@/lib/format'
import type { Id } from '@/types/api'
import type { Product, ProductShopStock } from '@/types/catalog'
import type { StockLot } from '@/types/stock'
import { useStockLots, useUpdateStockLot } from '../hooks'
import { ExpiryBadge } from './ExpiryBadge'
import { StockQuickSheet } from './StockQuickSheet'

/**
 * Stock par date d'un produit suivi dans la boutique courante (§7.11) : arrivages dans
 * l'ordre de sortie, date à indiquer ou corriger, retrait d'un arrivage périmé.
 */
export function ProductLotsSection({ product, shop, stock }: { product: Product; shop: { id: Id; name: string }; stock: ProductShopStock }) {
  const { t } = useTranslation()
  const can = useCan()
  const variants = stock.variants
  const [variantId, setVariantId] = useState<Id | null>(product.type === 'variable' ? (variants[0]?.id ?? null) : null)
  const lots = useStockLots(shop.id, product.id, variantId, product.type !== 'variable' || variantId !== null)
  const [editing, setEditing] = useState<StockLot | null>(null)
  const [removing, setRemoving] = useState<StockLot | null>(null)
  const unit = product.unit.short_name

  return (
    <FormSection title={t('stock.expiry.lots_title', { shop: shop.name })}>
      {product.type === 'variable' && variants.length > 0 && (
        <Select value={variantId === null ? '' : String(variantId)} onValueChange={(v) => setVariantId(Number(v))}>
          <SelectTrigger aria-label={t('stock.expiry.variant')} className="sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {lots.isPending ? (
        <LoadingState rows={2} />
      ) : lots.isError ? (
        <ErrorState error={lots.error} onRetry={() => void lots.refetch()} />
      ) : lots.data.length === 0 ? (
        <p className="text-muted-foreground">{t('stock.expiry.lots_empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {lots.data.map((lot) => (
            <li key={lot.id} className="flex flex-wrap items-center gap-3 rounded-md border-2 border-foreground px-3 py-2">
              <span className="grid min-w-0 flex-1">
                <span className="tabular font-bold">
                  {lot.expiry_date
                    ? t('stock.expiry.lot_line', { value: `${formatQuantity(lot.quantity)} ${unit}`, date: formatDay(lot.expiry_date) })
                    : t('stock.expiry.lot_undated', { value: `${formatQuantity(lot.quantity)} ${unit}` })}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(lot.received_at)}
                  {lot.reference ? ` · ${lot.reference}` : ''}
                </span>
              </span>
              <ExpiryBadge state={lot.state} />
              <span className="flex gap-2">
                {can('stock.adjust') && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(lot)}>
                    <CalendarDays aria-hidden="true" />
                    {lot.expiry_date ? t('stock.expiry.edit_date') : t('stock.expiry.add_date')}
                  </Button>
                )}
                {lot.state === 'expired' && can('stock.exit') && product.is_active && (
                  <Button type="button" variant="destructive" size="sm" onClick={() => setRemoving(lot)}>
                    <PackageMinus aria-hidden="true" />
                    {t('stock.expiry.remove_expired')}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <LotDateSheet lot={editing} shopId={shop.id} productName={product.name} unit={unit} onClose={() => setEditing(null)} />
      <StockQuickSheet
        kind={removing ? 'exit' : null}
        onClose={() => setRemoving(null)}
        product={product}
        shop={shop}
        stock={stock}
        lot={removing ? { ...removing, variant_id: variantId } : null}
      />
    </FormSection>
  )
}

function LotDateSheet({
  lot,
  shopId,
  productName,
  unit,
  onClose,
}: {
  lot: StockLot | null
  shopId: Id
  productName: string
  unit: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <ResponsiveSheet
      open={lot !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('stock.expiry.edit_title')}
      description={
        lot ? t('stock.expiry.edit_description', { value: `${formatQuantity(lot.quantity)} ${unit}`, name: productName, date: formatDateTime(lot.received_at) }) : undefined
      }
    >
      {lot && <LotDateForm key={lot.id} lot={lot} shopId={shopId} onDone={onClose} />}
    </ResponsiveSheet>
  )
}

function LotDateForm({ lot, shopId, onDone }: { lot: StockLot; shopId: Id; onDone: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateStockLot(shopId)
  const [date, setDate] = useState(lot.expiry_date ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = (expiryDate: string | null) =>
    update.mutate(
      { id: lot.id, expiryDate },
      {
        onSuccess: () => {
          toast.success(t('stock.expiry.saved'))
          onDone()
        },
        onError: (e) => setError(apiErrorMessage(e)),
      },
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save(date.trim() === '' ? null : date)
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && <FormAlert>{error}</FormAlert>}
      <FormField id="lot-expiry" label={t('stock.expiry.date')}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormField>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {lot.expiry_date && (
          <Button type="button" variant="outline" disabled={update.isPending} onClick={() => save(null)}>
            {t('stock.expiry.clear')}
          </Button>
        )}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  )
}
