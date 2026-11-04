import { zodResolver } from '@hookform/resolvers/zod'
import { HandCoins, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { FormAlert } from '@/components/FormField'
import { FormActions, FormSection } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { PaymentStatusBadge } from '@/features/sales/components/PaymentStatusBadge'
import { useCurrentShop } from '@/features/shops/hooks'
import { apiErrorMessage, applyApiErrors } from '@/lib/form-errors'
import { formatShortDate } from '@/lib/format'
import type { CustomerSummary } from '@/types/customers'
import { CustomerFields } from '../components/CustomerFields'
import { useCustomerSummary, useSaveCustomer } from '../hooks'
import { CUSTOMER_FIELDS, customerSchema, customerToForm, formToCustomer, type CustomerForm } from '../schemas'

const CREDIT_TONE = { open: 'danger', partial: 'warn', settled: 'paid', cancelled: 'neutral' } as const

/** Création (/clients/nouveau) ou fiche client (/clients/:id). */
export function CustomerPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const customerId = id ? Number(id) : undefined
  const summary = useCustomerSummary(customerId)

  return (
    <div className="grid gap-6">
      <BackLink to="/clients" label={t('customers.back')} />
      {customerId === undefined ? (
        <>
          <PageHeader title={t('customers.new_title')} />
          <CustomerEditor />
        </>
      ) : summary.isPending ? (
        <LoadingState rows={4} />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <CustomerDetail summary={summary.data} />
      )}
    </div>
  )
}

function CustomerDetail({ summary }: { summary: CustomerSummary }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const { customer, purchases } = summary
  const owes = Number(customer.balance) > 0

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={[customer.phone, customer.district].filter(Boolean).join(' · ') || undefined}
        actions={!customer.is_active && <StatusBadge>{t('customers.inactive')}</StatusBadge>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="pressable-lg grid gap-2 rounded-lg bg-card p-4">
          <span className="text-sm font-semibold text-muted-foreground">{t('customers.summary.due_total')}</span>
          <Money value={customer.balance} size="lg" className={owes ? 'text-destructive' : undefined} />
          {summary.balances.length > 1 && (
            <ul className="grid gap-0.5 text-sm">
              {summary.balances.map((b) => (
                <li key={b.shop.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t('customers.summary.by_shop', { shop: b.shop.name })}</span>
                  <Money value={b.balance} />
                </li>
              ))}
            </ul>
          )}
          {owes && can('repayments.create') && (
            <Button asChild className="mt-1">
              <Link to={`/credits/clients/${customer.id}/paiement`}>
                <HandCoins aria-hidden="true" />
                {t('customers.summary.repay')}
              </Link>
            </Button>
          )}
        </div>
        <Link to={`/ventes?client=${customer.id}&periode=all`} className="pressable-lg grid content-start gap-2 rounded-lg bg-card p-4">
          <span className="text-sm font-semibold text-muted-foreground">{t('customers.summary.purchases')}</span>
          <Money value={purchases.total} size="lg" />
          <span className="text-sm">
            {t('customers.summary.purchases_value', { count: purchases.count })}
            {' · '}
            {purchases.last_at ? t('customers.summary.last_purchase', { date: formatShortDate(purchases.last_at) }) : t('customers.summary.no_purchase')}
          </span>
        </Link>
      </div>

      <FormSection title={t('customers.summary.credits')}>
        {summary.credits.length === 0 ? (
          <p className="text-muted-foreground">{t('customers.summary.no_credits')}</p>
        ) : (
          <ul className="grid divide-y-2 divide-muted">
            {summary.credits.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="grid">
                  <span className="font-bold">
                    {c.is_opening_balance ? t('customers.summary.opening_balance') : c.sale?.reference} · {formatShortDate(c.occurred_at)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {c.shop.name} · {t('customers.summary.on_amount', { amount: Number(c.amount).toLocaleString('fr-FR') })}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {c.status !== 'settled' && c.status !== 'cancelled' && <Money value={c.remaining_amount} className="text-destructive" />}
                  <StatusBadge tone={CREDIT_TONE[c.status]}>{t(`customers.credit_status.${c.status}`)}</StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {summary.recent_sales.length > 0 && (
        <FormSection title={t('customers.summary.recent_sales')}>
          <ul className="grid divide-y-2 divide-muted">
            {summary.recent_sales.map((s) => {
              const content = (
                <>
                  <span className="grid">
                    <span className="font-bold">
                      {s.reference} · {formatShortDate(s.occurred_at)}
                    </span>
                    <span className="text-sm text-muted-foreground">{s.shop.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Money value={s.total} />
                    <PaymentStatusBadge status={s.payment_status} saleStatus={s.status} />
                  </span>
                </>
              )
              // Le détail d'une vente s'ouvre dans sa boutique : seulement si c'est la boutique courante.
              return (
                <li key={s.id}>
                  {s.shop.id === shop?.id && can('sales.view') ? (
                    <Link to={`/ventes/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-3 hover:bg-muted">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-3" title={t('customers.summary.other_shop', { shop: s.shop.name })}>
                      {content}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </FormSection>
      )}

      {can('customers.update') && <CustomerEditor summary={summary} />}
    </>
  )
}

function CustomerEditor({ summary }: { summary?: CustomerSummary }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const customer = summary?.customer
  const save = useSaveCustomer(customer?.id)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<CustomerForm>({ resolver: zodResolver(customerSchema), defaultValues: customerToForm(customer) })

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(formToCustomer(values, customer?.is_active ?? true), {
      onSuccess: (saved) => {
        if (customer) {
          form.reset(customerToForm(saved))
          toast.success(t('common.saved'))
        } else {
          toast.success(t('customers.form.created'))
          navigate(`/clients/${saved.id}`, { replace: true })
        }
      },
      onError: (error) => setFormError(applyApiErrors(error, form.setError, CUSTOMER_FIELDS)),
    })
  })

  const toggle = () =>
    customer &&
    save.mutate(formToCustomer(customerToForm(customer), !customer.is_active), {
      onSuccess: () => toast.success(customer.is_active ? t('customers.status.disabled') : t('customers.status.enabled')),
      onError: (error) => toast.error(apiErrorMessage(error)),
    })

  return (
    <>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}
        <FormSection title={t('customers.form.identity')}>
          <CustomerFields form={form} />
        </FormSection>
        <FormActions>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => (customer ? form.reset() : navigate('/clients'))}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={save.isPending || (customer && !form.formState.isDirty)}>
            {save.isPending ? t('common.saving') : customer ? t('common.save') : t('customers.add')}
          </Button>
        </FormActions>
      </form>
      {customer && (
        <FormSection
          title={t('customers.status.title')}
          description={`${customer.is_active ? t('customers.status.active_text') : t('customers.status.inactive_text')}${
            customer.is_active && Number(customer.balance) > 0 ? ` ${t('customers.status.has_due')}` : ''
          }`}
        >
          <Button variant={customer.is_active ? 'destructive' : 'outline'} className="justify-self-start" disabled={save.isPending} onClick={toggle}>
            {customer.is_active ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
            {customer.is_active ? t('customers.status.disable') : t('customers.status.enable')}
          </Button>
        </FormSection>
      )}
    </>
  )
}
