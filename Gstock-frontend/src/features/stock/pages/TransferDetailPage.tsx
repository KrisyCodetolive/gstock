import { Ban, PackageCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { CancelDialog } from '@/components/CancelDialog'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { FormSection } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { QuantityInput } from '@/components/QuantityInput'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { articleKey } from '@/lib/articles'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDateTime, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transfer } from '@/types/stock'
import { TransferStatusBadge } from '../components/TransferStatusBadge'
import { useCancelTransfer, useReceiveTransfer, useTransfer } from '../hooks'

/** Fiche d'un transfert TR-N (§7.12) : réception par la boutique d'arrivée, annulation par celle de départ. */
export function TransferDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { shop } = useCurrentShop()
  const transfer = useTransfer(shop?.id, Number(id))

  return (
    <div className="grid gap-6">
      <BackLink to="/stock/transferts" label={t('stock.transfers.back')} />
      {transfer.isPending ? (
        <LoadingState rows={3} />
      ) : transfer.isError ? (
        <ErrorState error={transfer.error} onRetry={() => void transfer.refetch()} />
      ) : (
        <TransferDetail key={`${transfer.data.id}-${transfer.data.status}`} transfer={transfer.data} />
      )}
    </div>
  )
}

function TransferDetail({ transfer: x }: { transfer: Transfer }) {
  const { t } = useTranslation()
  const can = useCan()
  const inTransit = x.status === 'in_transit'
  const receiving = inTransit && x.direction === 'in' && can('stock.entry')

  return (
    <>
      <PageHeader
        title={t('stock.transfers.detail.title', { reference: x.reference })}
        subtitle={t('stock.transfers.detail.route', { from: x.from_shop.name, to: x.to_shop.name })}
        actions={<TransferStatusBadge status={x.status} direction={x.direction} />}
      />
      <div className="grid gap-1 text-[15px]">
        <p className="text-muted-foreground">{t('stock.transfers.detail.sent', { date: formatDateTime(x.sent_at), name: x.sent_by?.name ?? '—' })}</p>
        {x.note && <p className="font-semibold">{t('stock.transfers.detail.note', { note: x.note })}</p>}
        {inTransit && x.direction === 'out' && <p className="font-semibold text-warn">{t('stock.transfers.detail.waiting', { shop: x.to_shop.name })}</p>}
        {x.received_at && (
          <p className="text-muted-foreground">{t('stock.transfers.detail.received', { date: formatDateTime(x.received_at), name: x.received_by?.name ?? '—' })}</p>
        )}
        {x.reception_note && <p className="font-semibold">{t('stock.transfers.detail.reception_note', { note: x.reception_note })}</p>}
        {x.status === 'received' && Number(x.missing_value) > 0 && (
          <p className="font-semibold text-destructive">{t('stock.transfers.detail.missing_value', { amount: Number(x.missing_value).toLocaleString('fr-FR') })}</p>
        )}
        {x.cancelled_at && (
          <p className="font-semibold text-destructive">{t('stock.transfers.detail.cancelled', { date: formatDateTime(x.cancelled_at), reason: x.cancel_reason })}</p>
        )}
      </div>

      {receiving ? (
        <ReceiveForm transfer={x} />
      ) : (
        <FormSection title={t('stock.form.products')}>
          <ul className="grid divide-y-2 divide-muted">
            {x.items.map((item) => {
              const unit = item.product.unit.short_name
              const missing = Number(item.missing_quantity) > 0
              return (
                <li key={articleKey(item.product.id, item.variant?.id)}>
                  <Link to={`/produits/${item.product.id}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-muted">
                    <span className="grid">
                      <span className="font-bold">{item.product.name}</span>
                      {item.received_quantity !== null && (
                        <span className={cn('text-sm', missing ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                          {t('stock.transfers.detail.received_qty', { value: `${formatQuantity(item.received_quantity)} ${unit}` })}
                          {missing && ` · ${t('stock.transfers.detail.missing_qty', { value: `${formatQuantity(item.missing_quantity)} ${unit}` })}`}
                        </span>
                      )}
                    </span>
                    <span className={cn('tabular text-lg font-extrabold', x.status === 'cancelled' && 'line-through opacity-60')}>
                      {formatQuantity(item.quantity)} {unit}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </FormSection>
      )}

      {inTransit && x.direction === 'out' && can('stock.transfer') && <CancelSection transfer={x} />}
    </>
  )
}

/** Réception : par défaut, tout ce qui a été envoyé ; un manque est compté dans les pertes. */
function ReceiveForm({ transfer: x }: { transfer: Transfer }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const receive = useReceiveTransfer(shop?.id, x.id)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(x.items.map((i) => [articleKey(i.product.id, i.variant?.id), String(Number(i.quantity))])),
  )
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const errorOf = (item: Transfer['items'][number]): string | null => {
    const raw = values[articleKey(item.product.id, item.variant?.id)] ?? ''
    const n = Number(raw.replace(',', '.'))
    if (raw.trim() === '' || !(n >= 0)) return t('stock.transfers.receive.invalid')
    if (n > Number(item.quantity)) return t('stock.transfers.receive.exceeds', { value: `${formatQuantity(item.quantity)} ${item.product.unit.short_name}` })
    return null
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (x.items.some(errorOf)) return
    receive.mutate(
      {
        note: note.trim() || null,
        items: x.items.map((i) => ({
          product_id: i.product.id,
          ...(i.variant ? { variant_id: i.variant.id } : {}),
          received_quantity: String(Number((values[articleKey(i.product.id, i.variant?.id)] ?? '0').replace(',', '.'))),
        })),
      },
      {
        onSuccess: () => toast.success(t('stock.transfers.receive.done', { shop: x.to_shop.name })),
        onError: (error) => setServerError(apiErrorMessage(error)),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <FormSection title={t('stock.transfers.receive.title')} description={t('stock.transfers.receive.intro')}>
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <ul className="grid gap-3">
          {x.items.map((item) => {
            const k = articleKey(item.product.id, item.variant?.id)
            const error = submitted ? errorOf(item) : null
            return (
              <li key={k} className="grid gap-3 rounded-md border-2 border-foreground p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="grid">
                  <span className="font-bold">{item.product.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('stock.transfers.receive.sent', { value: `${formatQuantity(item.quantity)} ${item.product.unit.short_name}` })}
                  </span>
                </span>
                <div className="grid gap-1">
                  <QuantityInput
                    id={`received-${k}`}
                    value={values[k] ?? ''}
                    onChange={(v) => setValues((s) => ({ ...s, [k]: v }))}
                    label={`${t('stock.transfers.receive.received')} — ${item.product.name}`}
                    invalid={Boolean(error)}
                    describedBy={error ? `received-${k}-error` : undefined}
                  />
                  {error && <FieldError id={`received-${k}-error`}>{error}</FieldError>}
                </div>
              </li>
            )
          })}
        </ul>
        <FormField id="reception-note" label={t('stock.transfers.receive.note')} optional>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <Button type="submit" variant="action" size="lg" className="sm:justify-self-end" disabled={receive.isPending}>
          <PackageCheck aria-hidden="true" />
          {receive.isPending ? t('common.saving') : t('stock.transfers.receive.submit')}
        </Button>
      </FormSection>
    </form>
  )
}

function CancelSection({ transfer }: { transfer: Transfer }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const cancel = useCancelTransfer(shop?.id, transfer.id)
  const [open, setOpen] = useState(false)

  return (
    <FormSection title={t('stock.transfers.cancel.action')} description={t('stock.transfers.cancel.text', { shop: transfer.from_shop.name })}>
      <Button variant="destructive" className="justify-self-start" onClick={() => setOpen(true)}>
        <Ban aria-hidden="true" />
        {t('stock.transfers.cancel.action')}
      </Button>
      <CancelDialog
        open={open}
        onOpenChange={setOpen}
        title={t('stock.transfers.cancel.title')}
        description={t('stock.transfers.cancel.text', { shop: transfer.from_shop.name })}
        reasonLabel={t('stock.adjustment.cancel_reason')}
        requiredMessage={t('stock.adjustment.cancel_reason_required')}
        confirmLabel={t('stock.transfers.cancel.action')}
        pending={cancel.isPending}
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync(reason)
            toast.success(t('stock.transfers.cancel.done'))
            return null
          } catch (e) {
            return apiErrorMessage(e)
          }
        }}
      />
    </FormSection>
  )
}
