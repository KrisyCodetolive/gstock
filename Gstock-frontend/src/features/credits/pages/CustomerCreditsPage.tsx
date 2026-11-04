import { FilePlus2, HandCoins, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { BackLink } from '@/components/BackLink'
import { FormSection } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatShortDate } from '@/lib/format'
import type { CustomerCreditFile } from '@/types/credits'
import { CreditItem } from '../components/CreditItem'
import { OpeningBalanceSheet } from '../components/CreditSheets'
import { useCustomerCredits } from '../hooks'

/** Fiche crédit d'un client (M09) : totaux, crédits, paiements reçus, avoir. */
export function CustomerCreditsPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const file = useCustomerCredits(Number(id))

  return (
    <div className="grid gap-6">
      <BackLink to="/credits" label={t('credits.back')} />
      {file.isPending ? (
        <LoadingState rows={4} />
      ) : file.isError ? (
        <ErrorState error={file.error} onRetry={() => void file.refetch()} />
      ) : (
        <CreditFile file={file.data} />
      )}
    </div>
  )
}

function CreditFile({ file }: { file: CustomerCreditFile }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const [opening, setOpening] = useState(false)
  const { customer, totals } = file
  const owesHere = Number(file.balances.find((b) => b.shop.id === shop?.id)?.balance ?? 0) > 0
  const note = Number(file.credit_note_balance)

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={[customer.phone, customer.district].filter(Boolean).join(' · ') || undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            {can('repayments.create') && owesHere && (
              <Button asChild variant="action">
                <Link to={`/credits/clients/${customer.id}/paiement`}>
                  <HandCoins aria-hidden="true" />
                  {t('credits.repay')}
                </Link>
              </Button>
            )}
            {can('credits.opening_balance') && (
              <Button variant="outline" onClick={() => setOpening(true)}>
                <FilePlus2 aria-hidden="true" />
                {t('credits.opening')}
              </Button>
            )}
            {can('customers.view') && (
              <Button asChild variant="ghost">
                <Link to={`/clients/${customer.id}`}>
                  <UserRound aria-hidden="true" />
                  {t('credits.file.see_customer')}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t('credits.file.credit_total'), value: <Money value={totals.credit_total} size="md" /> },
          { label: t('credits.file.repaid_total'), value: <Money value={totals.repaid_total} size="md" className="text-paid-ink" /> },
          { label: t('credits.file.balance'), value: <Money value={totals.balance} size="md" className={Number(totals.balance) > 0 ? 'text-destructive' : undefined} /> },
          ...(note > 0 ? [{ label: t('credits.file.credit_note'), value: <Money value={file.credit_note_balance} size="md" className="text-primary" />, hint: t('credits.file.credit_note_hint') }] : []),
        ].map((tile) => (
          <div key={tile.label} className="grid content-start gap-1 rounded-lg border-2 border-foreground bg-card p-4">
            <dt className="text-sm font-semibold text-muted-foreground">{tile.label}</dt>
            <dd className="grid gap-1">
              {tile.value}
              {'hint' in tile && <span className="text-xs text-muted-foreground">{tile.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {file.balances.length > 1 && (
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {file.balances.map((b) => (
            <li key={b.shop.id}>
              {t('credits.file.by_shop', { shop: b.shop.name })} : <Money value={b.balance} className="text-sm" />
            </li>
          ))}
        </ul>
      )}

      <section className="grid gap-3" aria-labelledby="credits-list">
        <h2 id="credits-list" className="text-xl font-bold">
          {t('credits.file.credits')}
        </h2>
        {file.credits.length === 0 ? (
          <p className="text-muted-foreground">{t('credits.file.no_credits')}</p>
        ) : (
          <ul className="grid gap-3">
            {file.credits.map((c) => (
              <CreditItem key={c.id} credit={c} />
            ))}
          </ul>
        )}
      </section>

      <FormSection title={t('credits.file.repayments')}>
        {file.repayments.length === 0 ? (
          <p className="text-muted-foreground">{t('credits.file.no_repayments')}</p>
        ) : (
          <ul className="grid divide-y-2 divide-muted">
            {file.repayments.map((r) => {
              const content = (
                <>
                  <span className="grid">
                    <span className="font-bold">
                      {r.reference} · {formatShortDate(r.received_at)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {r.method?.name ?? t('sales.detail.credit_note')} · {r.shop.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {r.status !== 'completed' && (
                      <StatusBadge tone={r.status === 'pending' ? 'warn' : 'neutral'}>{t(`credits.repayment_detail.${r.status}`)}</StatusBadge>
                    )}
                    <Money value={r.amount} className={r.status === 'cancelled' ? 'line-through opacity-60' : 'text-paid-ink'} />
                  </span>
                </>
              )
              return (
                <li key={r.id}>
                  {r.shop.id === shop?.id ? (
                    <Link to={`/credits/paiements/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-3 hover:bg-muted">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-3">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </FormSection>

      {file.refunds.length > 0 && (
        <FormSection title={t('credits.file.refunds')}>
          <ul className="grid gap-2">
            {file.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="grid">
                  <span className="font-bold">
                    {r.credit.reference} · {formatShortDate(r.created_at)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {r.method.name} · {r.reason}
                  </span>
                </span>
                <Money value={r.amount} />
              </li>
            ))}
          </ul>
        </FormSection>
      )}

      {opening && (
        <OpeningBalanceSheet open onOpenChange={setOpening} customer={{ id: customer.id, name: customer.name, phone: customer.phone, balance: totals.balance }} />
      )}
    </>
  )
}
