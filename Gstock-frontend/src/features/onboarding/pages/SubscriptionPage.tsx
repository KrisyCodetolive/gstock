import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CreditCard, Loader2, ReceiptText, Repeat } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { DataList } from '@/components/DataList'
import { FormAlert } from '@/components/FormField'
import { Pagination } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { meQueryKey } from '@/features/auth/hooks'
import { listInvoices } from '@/lib/api/subscription'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatAmount, formatLongDate, formatShortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Invoice, InvoiceStatus, Plan, Subscription } from '@/types/subscription'
import { PlanOption } from '../components/PlanCard'
import { useCheckout, useInvoices, usePlans, useSubscription } from '../hooks'

// Outils pour faire avancer le temps : seulement avec les données simulées.
const SimulationTools =
  import.meta.env.VITE_USE_MOCKS === 'true'
    ? lazy(() => import('@/mocks/components/SubscriptionSimulation').then((m) => ({ default: m.SubscriptionSimulation })))
    : null

const INVOICE_TONE: Record<InvoiceStatus, 'paid' | 'warn' | 'danger'> = { paid: 'paid', pending: 'warn', failed: 'danger' }

/** « Mon abonnement » (M00) : formule, échéance, paiement GeniusPay, factures. */
export function SubscriptionPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const subscription = useSubscription()
  const pending = subscription.data?.pending_invoice ?? null
  const watched = useRef<Invoice | null>(null)

  // Le paiement n'est validé qu'au webhook : on relit l'état tant qu'une facture est en attente,
  // puis on annonce le résultat (prolongé ou non).
  useEffect(() => {
    if (!subscription.data) return
    if (pending) {
      watched.current = pending
      return
    }
    const invoice = watched.current
    if (!invoice) return
    watched.current = null
    void queryClient.invalidateQueries({ queryKey: meQueryKey })
    void queryClient.invalidateQueries({ queryKey: ['subscription', 'invoices'] })
    void listInvoices({ per_page: 20 }).then((page) => {
      const result = page.data.find((i) => i.id === invoice.id)
      if (result?.status === 'paid') toast.success(t('subscription.paid_toast'))
      else toast.error(t('subscription.failed_toast', { reference: invoice.reference }))
    })
  }, [subscription.data, pending, queryClient, t])

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres" label={t('settings.back')} />
      <PageHeader title={t('subscription.title')} />
      {subscription.isPending ? (
        <LoadingState rows={3} />
      ) : subscription.isError ? (
        <ErrorState error={subscription.error} onRetry={() => void subscription.refetch()} />
      ) : (
        <>
          <StatusCard subscription={subscription.data} />
          <Usage subscription={subscription.data} />
          <Invoices />
          {SimulationTools && (
            <Suspense>
              <SimulationTools />
            </Suspense>
          )}
        </>
      )}
    </div>
  )
}

function statusTone(s: Subscription): 'paid' | 'warn' | 'danger' | 'neutral' {
  if (s.read_only || s.status === 'cancelled') return 'danger'
  if (s.status === 'past_due') return 'warn'
  if (s.status === 'active') return 'paid'
  return 'neutral'
}

function StatusCard({ subscription: s }: { subscription: Subscription }) {
  const { t } = useTranslation()
  const [choosing, setChoosing] = useState(false)
  const pay = useCheckout()
  const statusKey = s.read_only ? 'suspended' : s.status

  const goPay = (plan: Plan) =>
    pay.mutate(
      { plan_id: plan.id },
      // Page de paiement GeniusPay ; elle renvoie ensuite ici.
      { onSuccess: (result) => window.location.assign(result.checkout_url) },
    )

  let text: string
  if (s.read_only) text = t('subscription.suspended_text')
  else if (s.status === 'trial') text = t('subscription.trial_left', { count: s.days_left, date: formatLongDate(s.trial_ends_at!) })
  else if (s.status === 'past_due') text = t('subscription.past_due_text', { count: s.days_left })
  else if (s.status === 'active') text = t('subscription.active_until', { date: formatLongDate(s.ends_at!) })
  else text = ''

  return (
    <section
      className={cn('pressable-lg grid gap-4 rounded-lg p-4 sm:p-5', s.read_only ? 'bg-destructive-bg' : s.status === 'past_due' ? 'bg-warn-bg' : 'bg-card')}
      aria-labelledby="subscription-plan"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="subscription-plan" className="text-xl font-bold">
          {t('subscription.plan', { name: s.plan.name })}
        </h2>
        <StatusBadge tone={statusTone(s)}>{t(`subscription.status.${statusKey}`)}</StatusBadge>
      </div>
      <p className="flex gap-2 text-[15px]">
        {(s.read_only || s.status === 'past_due') && <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
        {text}
      </p>

      {s.pending_invoice ? (
        <div className="flex gap-3 rounded-md border-2 border-foreground bg-card p-3" role="status">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin" aria-hidden="true" />
          <div className="grid gap-0.5">
            <p className="font-bold">{t('subscription.pending_title')}</p>
            <p className="text-sm text-muted-foreground">{t('subscription.pending_text', { reference: s.pending_invoice.reference })}</p>
          </div>
        </div>
      ) : (
        s.status !== 'cancelled' && (
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            {pay.error && !choosing && <FormAlert>{apiErrorMessage(pay.error)}</FormAlert>}
            <Button variant="action" size="lg" disabled={pay.isPending} onClick={() => goPay(s.plan)}>
              {pay.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CreditCard strokeWidth={2.6} aria-hidden="true" />}
              {pay.isPending ? t('subscription.redirecting') : s.status === 'active' ? t('subscription.renew') : t('subscription.pay', { amount: `${formatAmount(s.plan.price)} FCFA` })}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setChoosing(true)}>
              <Repeat aria-hidden="true" />
              {t('subscription.change_plan')}
            </Button>
          </div>
        )
      )}
      <p className="text-sm text-muted-foreground">{t('subscription.pay_hint')}</p>

      {choosing && <PlanChooser current={s.plan} onClose={() => setChoosing(false)} onPay={goPay} paying={pay.isPending} error={pay.error} />}
    </section>
  )
}

function PlanChooser({ current, onClose, onPay, paying, error }: { current: Plan; onClose: () => void; onPay: (plan: Plan) => void; paying: boolean; error: unknown }) {
  const { t } = useTranslation()
  const plans = usePlans()
  const [selected, setSelected] = useState<Plan>(current)

  return (
    <ResponsiveSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('subscription.choose_plan')}
      description={t('subscription.choose_plan_text')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="action" disabled={paying} onClick={() => onPay(selected)}>
            {paying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
            {paying ? t('subscription.redirecting') : t('subscription.pay_for', { name: selected.name })}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {Boolean(error) && <FormAlert>{apiErrorMessage(error)}</FormAlert>}
        {plans.isPending ? (
          <LoadingState rows={3} />
        ) : plans.isError ? (
          <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
        ) : (
          <div role="radiogroup" aria-label={t('subscription.choose_plan')} className="grid gap-3">
            {plans.data.map((plan) => (
              <PlanOption
                key={plan.id}
                plan={plan}
                selected={selected.id === plan.id}
                onSelect={() => setSelected(plan)}
                badge={plan.id === current.id ? <StatusBadge tone="paid">{t('plans.current')}</StatusBadge> : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </ResponsiveSheet>
  )
}

function Usage({ subscription: s }: { subscription: Subscription }) {
  const { t } = useTranslation()
  const rows = [
    { label: t('subscription.usage_shops'), used: s.usage.shops, max: s.plan.max_shops },
    { label: t('subscription.usage_users'), used: s.usage.users, max: s.plan.max_users },
    { label: t('subscription.usage_products'), used: s.usage.products, max: s.plan.max_products },
  ]
  return (
    <section className="grid gap-4 rounded-lg border-2 border-foreground bg-card p-4 sm:p-5" aria-labelledby="usage-title">
      <h2 id="usage-title" className="text-lg font-bold">
        {t('subscription.usage')}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {rows.map((r) => {
          const ratio = Math.min(1, r.used / r.max)
          return (
            <li key={r.label} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{r.label}</span>
                <span className="tabular text-sm font-bold">{t('subscription.usage_of', { used: r.used.toLocaleString('fr-FR'), max: r.max.toLocaleString('fr-FR') })}</span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full border-2 border-foreground bg-muted"
                role="meter"
                aria-label={r.label}
                aria-valuemin={0}
                aria-valuemax={r.max}
                aria-valuenow={r.used}
              >
                <div className={cn('h-full', ratio >= 1 ? 'bg-destructive' : ratio >= 0.8 ? 'bg-warn' : 'bg-paid')} style={{ width: `${ratio * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Invoices() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const invoices = useInvoices({ page, per_page: 10 })
  const [selected, setSelected] = useState<Invoice | null>(null)

  return (
    <section className="grid gap-3" aria-labelledby="invoices-title">
      <h2 id="invoices-title" className="text-xl font-bold">
        {t('subscription.invoices')}
      </h2>
      {invoices.isPending ? (
        <LoadingState rows={2} />
      ) : invoices.isError ? (
        <ErrorState error={invoices.error} onRetry={() => void invoices.refetch()} />
      ) : invoices.data.data.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t('subscription.invoices_empty')} />
      ) : (
        <>
          <DataList
            label={t('subscription.invoices')}
            items={invoices.data.data}
            getKey={(i) => i.id}
            onSelect={setSelected}
            columns={[
              { header: t('subscription.columns.reference'), cell: (i) => <span className="font-bold">{i.reference}</span> },
              { header: t('subscription.columns.date'), cell: (i) => formatShortDate(i.created_at) },
              { header: t('subscription.columns.plan'), cell: (i) => i.plan_name },
              { header: t('subscription.columns.channel'), cell: (i) => i.payment_channel ?? '—', className: 'text-muted-foreground' },
              { header: t('subscription.columns.amount'), cell: (i) => <Money value={i.amount} /> },
              { header: t('subscription.columns.status'), cell: (i) => <StatusBadge tone={INVOICE_TONE[i.status]}>{t(`subscription.invoice_status.${i.status}`)}</StatusBadge> },
            ]}
            card={(i) => (
              <div className="flex items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <span className="font-bold">
                    {i.reference} · {i.plan_name}
                  </span>
                  <span className="text-sm text-muted-foreground">{[formatShortDate(i.created_at), i.payment_channel].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="grid justify-items-end gap-1">
                  <Money value={i.amount} />
                  <StatusBadge tone={INVOICE_TONE[i.status]}>{t(`subscription.invoice_status.${i.status}`)}</StatusBadge>
                </div>
              </div>
            )}
          />
          <Pagination page={invoices.data.meta.current_page} lastPage={invoices.data.meta.last_page} total={invoices.data.meta.total} onPage={setPage} />
        </>
      )}

      <ResponsiveSheet
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? t('subscription.detail.title', { reference: selected.reference }) : ''}
      >
        {selected && (
          <dl className="grid gap-3 text-[15px]">
            {[
              [t('subscription.columns.plan'), selected.plan_name],
              [t('subscription.columns.amount'), <Money key="a" value={selected.amount} />],
              [t('subscription.columns.status'), <StatusBadge key="s" tone={INVOICE_TONE[selected.status]}>{t(`subscription.invoice_status.${selected.status}`)}</StatusBadge>],
              [t('subscription.columns.channel'), selected.payment_channel ?? t('subscription.detail.none')],
              [t('subscription.detail.created'), formatLongDate(selected.created_at)],
              [t('subscription.detail.paid'), selected.paid_at ? formatLongDate(selected.paid_at) : t('subscription.detail.none')],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3 border-b-2 border-muted pb-2">
                <dt className="font-semibold text-muted-foreground">{label}</dt>
                <dd className="text-right font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </ResponsiveSheet>
    </section>
  )
}
