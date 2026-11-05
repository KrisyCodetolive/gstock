import { Ban, CalendarClock, HandCoins } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { CancelDialog } from '@/components/CancelDialog'
import { FormAlert, FormField } from '@/components/FormField'
import { InstallmentScheduleSheet } from '@/components/InstallmentScheduleSheet'
import { FormSection } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCan } from '@/features/auth/hooks'
import { InstallmentStatusBadge } from '@/features/credits/components/badges'
import { useReferentialList } from '@/features/referentials/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { articleKey } from '@/lib/articles'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDateTime, formatDay, formatQuantity, formatShortDate } from '@/lib/format'
import type { Purchase } from '@/types/purchases'
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge'
import { useAddPurchasePayment, useCancelPurchase, usePurchase, useSetPurchaseInstallments } from '../hooks'

export function PurchaseDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { shop } = useCurrentShop()
  const purchase = usePurchase(shop?.id, Number(id))
  return (
    <div className="grid gap-6">
      <BackLink to="/approvisionnements" label={t('purchases.back')} />
      {purchase.isPending ? (
        <LoadingState rows={4} />
      ) : purchase.isError ? (
        <ErrorState error={purchase.error} onRetry={() => void purchase.refetch()} />
      ) : (
        <PurchaseDetail purchase={purchase.data} />
      )}
    </div>
  )
}

function PurchaseDetail({ purchase: p }: { purchase: Purchase }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const cancel = useCancelPurchase(shop?.id, p.id)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const schedule = useSetPurchaseInstallments(shop?.id, p.id)
  const cancelled = p.status === 'cancelled'
  const owing = !cancelled && Number(p.due_amount) > 0

  return (
    <>
      <PageHeader
        title={t('purchases.detail.title', { reference: p.reference })}
        subtitle={t('purchases.detail.by', { name: p.user?.name ?? '—', date: formatDateTime(p.occurred_at) })}
        actions={<PurchaseStatusBadge status={p.payment_status} purchaseStatus={p.status} />}
      />
      {cancelled && p.cancelled_at && (
        <p className="rounded-sm border-2 border-destructive bg-destructive-bg p-3 font-semibold text-destructive">
          {t('purchases.detail.cancelled_on', { date: formatDateTime(p.cancelled_at), reason: p.cancel_reason })}
        </p>
      )}
      {p.supplier && (
        <FormSection title={t('purchases.form.supplier')}>
          {can('suppliers.view') ? (
            <Link to={`/fournisseurs/${p.supplier.id}`} className="font-bold text-primary hover:underline">
              {p.supplier.name}
            </Link>
          ) : (
            <span className="font-bold">{p.supplier.name}</span>
          )}
        </FormSection>
      )}

      <FormSection title={t('purchases.detail.items')}>
        <ul className="grid divide-y-2 divide-muted">
          {p.items.map((i) => (
            // Deux lignes d'un même article sont possibles avec deux dates de péremption (§7.11).
            <li key={`${articleKey(i.product.id, i.variant?.id)}-${i.expiry_date ?? ''}`}>
              <Link to={`/produits/${i.product.id}`} className="flex items-start justify-between gap-3 rounded-md px-1 py-3 hover:bg-muted">
                <span className="grid">
                  <span className="font-bold">{i.product.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('purchases.detail.unit', { qty: `${formatQuantity(i.quantity)} ${i.unit.short_name}`, cost: Number(i.cost).toLocaleString('fr-FR') })}
                  </span>
                  {i.unit.id !== i.product.unit.id && (
                    <span className="text-sm text-muted-foreground">
                      {t('purchases.form.base_quantity', { qty: formatQuantity(i.base_quantity), unit: i.product.unit.short_name })}
                    </span>
                  )}
                  {i.expiry_date && (
                    <span className="text-sm text-muted-foreground">{`${t('stock.expiry.date')} : ${formatDay(i.expiry_date)}`}</span>
                  )}
                </span>
                <Money value={i.subtotal} />
              </Link>
            </li>
          ))}
        </ul>
        <dl className="grid gap-1 border-t-2 border-foreground pt-3">
          {Number(p.discount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('purchases.form.discount')}</dt>
              <dd>
                − <Money value={p.discount} />
              </dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <dt>{t('purchases.form.total')}</dt>
            <dd>
              <Money value={p.total} size="md" />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('purchases.summary.paid')}</dt>
            <dd>
              <Money value={p.paid_amount} className="text-paid-ink" />
            </dd>
          </div>
          {Number(p.due_amount) > 0 && (
            <div className="flex justify-between font-bold">
              <dt>{t('purchases.summary.due')}</dt>
              <dd>
                <Money value={p.due_amount} className="text-destructive" />
              </dd>
            </div>
          )}
        </dl>
      </FormSection>

      <FormSection title={t('purchases.detail.payments')}>
        {p.payments.length === 0 ? (
          <p className="text-muted-foreground">{t('purchases.detail.no_payment')}</p>
        ) : (
          <ul className="grid gap-2">
            {p.payments.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="grid">
                  <span className="font-bold">
                    {x.method.name} · {formatShortDate(x.paid_at)}
                  </span>
                  {x.note && <span className="text-sm text-muted-foreground">{x.note}</span>}
                </span>
                <Money value={x.amount} />
              </li>
            ))}
          </ul>
        )}
        {!cancelled && Number(p.due_amount) > 0 && can('purchase_payments.create') && (
          <Button className="justify-self-start" onClick={() => setPayOpen(true)}>
            <HandCoins aria-hidden="true" />
            {t('purchases.detail.pay')}
          </Button>
        )}
      </FormSection>

      {(owing || p.installments.length > 0) && (
        <FormSection title={t('purchases.detail.installments')} description={t('purchases.detail.installments_hint')}>
          {p.installments.length === 0 ? (
            <p className="text-muted-foreground">{t('purchases.detail.no_installments')}</p>
          ) : (
            <ul className="grid gap-2">
              {p.installments.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{formatShortDate(i.due_date)}</span>
                  <span className="flex items-center gap-2">
                    <Money value={i.amount} />
                    <InstallmentStatusBadge status={i.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {owing && can('purchase_payments.create') && (
            <Button variant="outline" className="justify-self-start" onClick={() => setScheduleOpen(true)}>
              <CalendarClock aria-hidden="true" />
              {p.installments.length ? t('purchases.detail.schedule_edit') : t('purchases.detail.schedule')}
            </Button>
          )}
        </FormSection>
      )}
      {scheduleOpen && (
        <InstallmentScheduleSheet
          open
          onOpenChange={(o) => !o && setScheduleOpen(false)}
          title={t('purchases.detail.schedule_title', { reference: p.reference })}
          remaining={Number(p.due_amount)}
          installments={p.installments}
          pending={schedule.isPending}
          onSave={(items) => schedule.mutateAsync(items)}
        />
      )}

      {!cancelled && can('purchases.cancel') && (
        <FormSection title={t('purchases.detail.cancel')} description={t('purchases.detail.cancel_text')}>
          <Button variant="destructive" className="justify-self-start" onClick={() => setCancelOpen(true)}>
            <Ban aria-hidden="true" />
            {t('purchases.detail.cancel')}
          </Button>
          <CancelDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title={t('purchases.detail.cancel_title', { reference: p.reference })}
            description={t('purchases.detail.cancel_text')}
            reasonLabel={t('purchases.detail.cancel_reason')}
            requiredMessage={t('purchases.detail.cancel_reason_required')}
            confirmLabel={t('purchases.detail.cancel')}
            pending={cancel.isPending}
            onConfirm={async (reason) => {
              try {
                await cancel.mutateAsync(reason)
                toast.success(t('purchases.detail.cancelled_done'))
                return null
              } catch (e) {
                return apiErrorMessage(e)
              }
            }}
          />
        </FormSection>
      )}

      {payOpen && <PaySupplierSheet purchase={p} onClose={() => setPayOpen(false)} />}
    </>
  )
}

/** Paiement ultérieur au fournisseur, jamais au-delà du reste dû. */
function PaySupplierSheet({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const pay = useAddPurchasePayment(shop?.id, purchase.id)
  const methods = useReferentialList('payment-methods', { per_page: 100, filter: { is_active: 'true' } })
  const [amount, setAmount] = useState(String(Number(purchase.due_amount)))
  const [method, setMethod] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    pay.mutate(
      { amount: amount.replace(/\s/g, '').replace(',', '.'), payment_method_id: Number(method) },
      {
        onSuccess: () => {
          toast.success(t('purchases.detail.paid_done'))
          onClose()
        },
        onError: (err) => setError(apiErrorMessage(err)),
      },
    )
  }

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={t('purchases.detail.pay_title')} description={t('purchases.detail.pay_hint', { amount: Number(purchase.due_amount).toLocaleString('fr-FR') })}>
      <form onSubmit={submit} noValidate className="grid min-h-full content-between gap-6">
        <div className="grid gap-5">
          {error && <FormAlert>{error}</FormAlert>}
          <FormField id="supplier-pay-amount" label={t('purchases.detail.pay_amount')}>
            <Input inputMode="numeric" className="tabular text-lg font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <div className="grid gap-2">
            <label htmlFor="supplier-pay-method" className="text-sm font-semibold">
              {t('purchases.form.method')}
            </label>
            <Select value={method || undefined} onValueChange={setMethod}>
              <SelectTrigger id="supplier-pay-method">
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
        <div className="sticky -bottom-4 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-muted bg-popover px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={pay.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={pay.isPending}>
            {pay.isPending ? t('common.saving') : t('purchases.detail.pay_submit')}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  )
}
