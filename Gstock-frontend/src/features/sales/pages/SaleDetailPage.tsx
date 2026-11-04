import { Ban, Loader2, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { CancelDialog } from '@/components/CancelDialog'
import { FormSection } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDateTime, formatQuantity } from '@/lib/format'
import type { Sale } from '@/types/sales'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { useCancelSale, useSale } from '../hooks'

export function SaleDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { shop } = useCurrentShop()
  const sale = useSale(shop?.id, Number(id))

  return (
    <div className="grid gap-6">
      <BackLink to="/ventes" label={t('sales.detail.back')} />
      {sale.isPending ? (
        <LoadingState rows={4} />
      ) : sale.isError ? (
        <ErrorState error={sale.error} onRetry={() => void sale.refetch()} />
      ) : (
        <SaleDetail sale={sale.data} />
      )}
    </div>
  )
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between gap-2 text-lg font-bold' : 'flex justify-between gap-2'}>
      <dt className={strong ? undefined : 'text-muted-foreground'}>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function SaleDetail({ sale }: { sale: Sale }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const cancel = useCancelSale(shop?.id, sale.id)
  const [cancelOpen, setCancelOpen] = useState(false)
  const cancelled = sale.status === 'cancelled'

  return (
    <>
      <PageHeader
        title={t('sales.detail.title', { reference: sale.reference })}
        subtitle={t('sales.detail.by', { name: sale.user?.name ?? '—', date: formatDateTime(sale.occurred_at) })}
        actions={<PaymentStatusBadge status={sale.payment_status} saleStatus={sale.status} />}
      />
      {cancelled && sale.cancelled_at && (
        <p className="rounded-sm border-2 border-destructive bg-destructive-bg p-3 font-semibold text-destructive">
          {t('sales.detail.cancelled_on', { date: formatDateTime(sale.cancelled_at), reason: sale.cancel_reason })}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to={`/ventes/${sale.id}/recu`}>
            <ReceiptText aria-hidden="true" />
            {t('sales.detail.receipt')}
          </Link>
        </Button>
      </div>

      {sale.customer && (
        <FormSection title={t('sales.detail.customer')}>
          {can('customers.view') ? (
            <Link to={`/clients/${sale.customer.id}`} className="font-bold text-primary hover:underline">
              {sale.customer.name}
            </Link>
          ) : (
            <span className="font-bold">{sale.customer.name}</span>
          )}
          {sale.customer.phone && <span className="tabular text-muted-foreground">{sale.customer.phone}</span>}
        </FormSection>
      )}

      <FormSection title={t('sales.detail.items')}>
        <ul className="grid divide-y-2 divide-muted">
          {sale.items.map((i) => (
            <li key={i.product.id} className="flex items-start justify-between gap-3 py-3">
              <span className="grid">
                <span className="font-bold">{i.product.name}</span>
                <span className="text-sm text-muted-foreground">
                  {t('sales.detail.unit_price', { qty: `${formatQuantity(i.quantity)} ${i.product.unit.short_name}`, price: Number(i.price).toLocaleString('fr-FR') })}
                  {Number(i.discount_amount) > 0 && ` · ${t('sales.detail.with_discount', { amount: Number(i.discount_amount).toLocaleString('fr-FR') })}`}
                </span>
              </span>
              <Money value={i.subtotal} />
            </li>
          ))}
        </ul>
        <dl className="grid gap-1 border-t-2 border-foreground pt-3">
          {Number(sale.discount) > 0 && (
            <>
              <Row label={t('sales.detail.subtotal')}><Money value={sale.subtotal} /></Row>
              <Row label={t('sales.detail.discount')}>− <Money value={sale.discount} /></Row>
            </>
          )}
          <Row label={t('sales.detail.total')} strong><Money value={sale.total} size="md" /></Row>
          <Row label={t('sales.detail.paid_now')}><Money value={sale.paid_now} className="text-paid-ink" /></Row>
          {Number(sale.credit_amount) > 0 && (
            <Row label={t('sales.detail.credit_amount')}><Money value={sale.credit_amount} className="text-destructive" /></Row>
          )}
        </dl>
      </FormSection>

      <FormSection title={t('sales.detail.payments')}>
        {sale.payments.length === 0 ? (
          <p className="text-muted-foreground">{t('sales.detail.no_payment')}</p>
        ) : (
          <ul className="grid gap-2">
            {sale.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="grid">
                  <span className="font-bold">{p.method?.name ?? t('sales.detail.credit_note')}</span>
                  {p.cash_given && Number(p.change) > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {t('sales.detail.cash_given', { given: Number(p.cash_given).toLocaleString('fr-FR'), change: Number(p.change).toLocaleString('fr-FR') })}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {p.status === 'pending' && (
                    <StatusBadge tone="warn">
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      {t('sales.detail.pending')}
                    </StatusBadge>
                  )}
                  <Money value={p.amount} className={p.status === 'cancelled' ? 'line-through opacity-60' : undefined} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {sale.credit && sale.credit.status !== 'cancelled' && Number(sale.credit.remaining_amount) > 0 && (
          <p className="font-semibold text-destructive">{t('sales.detail.credit_remaining', { amount: Number(sale.credit.remaining_amount).toLocaleString('fr-FR') })}</p>
        )}
      </FormSection>

      {sale.note && (
        <FormSection title={t('sales.detail.note')}>
          <p>{sale.note}</p>
        </FormSection>
      )}

      {!cancelled && can('sales.cancel') && (
        <FormSection title={t('sales.cancel.title')} description={t('sales.cancel.text')}>
          <Button variant="destructive" className="justify-self-start" onClick={() => setCancelOpen(true)}>
            <Ban aria-hidden="true" />
            {t('sales.cancel.button')}
          </Button>
          <CancelDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title={t('sales.cancel.confirm_title', { reference: sale.reference })}
            description={t('sales.cancel.text')}
            reasonLabel={t('sales.cancel.reason')}
            requiredMessage={t('sales.cancel.reason_required')}
            confirmLabel={t('sales.cancel.button')}
            pending={cancel.isPending}
            onConfirm={async (reason) => {
              try {
                await cancel.mutateAsync(reason)
                toast.success(t('sales.cancel.done'))
                return null
              } catch (e) {
                return apiErrorMessage(e)
              }
            }}
          />
        </FormSection>
      )}
    </>
  )
}
