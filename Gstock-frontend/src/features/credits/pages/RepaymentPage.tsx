import { Ban, Copy, Loader2, MessageCircle, Printer } from 'lucide-react'
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
import { formatDateTime } from '@/lib/format'
import type { Repayment } from '@/types/credits'
import { RepaymentTicket } from '../components/RepaymentTicket'
import { useCancelRepayment, useRepayment, useRepaymentReceipt, useRepaymentShareLink } from '../hooks'

const TONE = { pending: 'warn', completed: 'paid', cancelled: 'neutral' } as const

function whatsappUrl(message: string, phone: string | null) {
  const digits = phone?.replace(/\D/g, '')
  const to = digits ? (digits.length === 10 ? `225${digits}` : digits) : ''
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`
}

/** Un paiement RB-N : détail, reçu imprimable ou partageable (ADR-013), annulation motivée. */
export function RepaymentPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { shop } = useCurrentShop()
  const repayment = useRepayment(shop?.id, Number(id))

  return (
    <div className="grid gap-6">
      <div className="no-print">
        <BackLink to={repayment.data ? `/credits/clients/${repayment.data.customer.id}` : '/credits'} label={repayment.data?.customer.name ?? t('credits.back')} />
      </div>
      {repayment.isPending ? (
        <LoadingState rows={3} />
      ) : repayment.isError ? (
        <ErrorState error={repayment.error} onRetry={() => void repayment.refetch()} />
      ) : (
        <RepaymentDetail repayment={repayment.data} />
      )}
    </div>
  )
}

function RepaymentDetail({ repayment: r }: { repayment: Repayment }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const receipt = useRepaymentReceipt(shop?.id, r.id)
  const share = useRepaymentShareLink(shop?.id, r.id)
  const cancel = useCancelRepayment(shop?.id, r.id)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [link, setLink] = useState<string | null>(null)

  return (
    <>
      <div className="no-print grid gap-6">
        <PageHeader
          title={t('credits.repayment_detail.title', { reference: r.reference })}
          subtitle={t('credits.repayment_detail.by', { name: r.user?.name ?? '—', date: formatDateTime(r.received_at) })}
          actions={
            <StatusBadge tone={TONE[r.status]}>
              {r.status === 'pending' && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
              {t(`credits.repayment_detail.${r.status}`)}
            </StatusBadge>
          }
        />
        {r.status === 'cancelled' && r.cancelled_at && (
          <p className="rounded-sm border-2 border-destructive bg-destructive-bg p-3 font-semibold text-destructive">
            {t('credits.repayment_detail.cancelled_on', { date: formatDateTime(r.cancelled_at), reason: r.cancel_reason })}
          </p>
        )}
        {r.status === 'pending' && <p className="font-semibold text-primary">{t('credits.repayment_detail.pending')}</p>}

        <FormSection title={r.customer.name}>
          <Money value={r.amount} size="lg" className="text-paid-ink" />
          <p className="text-muted-foreground">{r.paid_with_credit_note ? t('credits.repayment_detail.paid_with_credit_note') : r.method?.name}</p>
          <div className="grid gap-1">
            <h3 className="text-sm font-bold">{t('credits.repayment_detail.allocations')}</h3>
            <ul className="grid gap-0.5">
              {r.allocations.map((a) => (
                <li key={a.credit.id} className="flex justify-between gap-2">
                  <span>{a.credit.is_opening_balance ? `${t('credits.opening_balance')} ${a.credit.reference}` : a.credit.reference}</span>
                  <Money value={a.amount} />
                </li>
              ))}
            </ul>
          </div>
          <p className="font-bold">{t('credits.repayment_detail.balance_after', { amount: Number(r.balance_after).toLocaleString('fr-FR') })}</p>
          {r.note && <p className="text-muted-foreground">{r.note}</p>}
          <Link to={`/credits/clients/${r.customer.id}`} className="justify-self-start text-sm font-bold text-primary hover:underline">
            {t('credits.back')}
          </Link>
        </FormSection>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="action"
            disabled={!receipt.data || share.isPending}
            onClick={() =>
              share.mutate(undefined, {
                onSuccess: (l) => {
                  setLink(l.url)
                  window.open(whatsappUrl(l.message, r.customer.phone), '_blank', 'noopener')
                },
                onError: (e) => toast.error(apiErrorMessage(e)),
              })
            }
          >
            <MessageCircle aria-hidden="true" />
            {share.isPending ? t('sales.receipt.sharing') : t('sales.receipt.share')}
          </Button>
          <Button variant="outline" disabled={!receipt.data} onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            {t('sales.receipt.print')}
          </Button>
        </div>
        {link && (
          <div className="flex flex-wrap items-center gap-2 rounded-sm bg-muted p-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono">{link}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(link).then(
                  () => toast.success(t('sales.receipt.copied')),
                  () => undefined,
                )
              }
            >
              <Copy aria-hidden="true" />
              {t('sales.receipt.copy')}
            </Button>
          </div>
        )}
      </div>

      {receipt.data && (
        <div className="print-area overflow-x-auto rounded-lg border-2 border-foreground bg-muted p-4">
          <RepaymentTicket receipt={receipt.data} />
        </div>
      )}

      {r.status !== 'cancelled' && can('repayments.cancel') && (
        <div className="no-print">
          <FormSection title={t('credits.repayment_detail.cancel')} description={t('credits.repayment_detail.cancel_text')}>
            <Button variant="destructive" className="justify-self-start" onClick={() => setCancelOpen(true)}>
              <Ban aria-hidden="true" />
              {t('credits.repayment_detail.cancel')}
            </Button>
            <CancelDialog
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              title={t('credits.repayment_detail.cancel_title', { reference: r.reference })}
              description={t('credits.repayment_detail.cancel_text')}
              reasonLabel={t('credits.repayment_detail.cancel_reason')}
              requiredMessage={t('credits.repayment_detail.cancel_reason_required')}
              confirmLabel={t('credits.repayment_detail.cancel')}
              pending={cancel.isPending}
              onConfirm={async (reason) => {
                try {
                  await cancel.mutateAsync(reason)
                  toast.success(t('credits.repayment_detail.cancelled_done'))
                  return null
                } catch (e) {
                  return apiErrorMessage(e)
                }
              }}
            />
          </FormSection>
        </div>
      )}
    </>
  )
}
