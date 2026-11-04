import { AlarmClock, FilePlus2, HandCoins, Info, Users, Wallet, WalletCards } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { CustomerPicker } from '@/features/pos/components/CustomerPicker'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatShortDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { cn } from '@/lib/utils'
import { CreditStatusBadge, InstallmentStatusBadge } from '../components/badges'
import { OpeningBalanceSheet } from '../components/CreditSheets'
import { useCreditList, useCreditsSummary, useDebtors, useInstallments, useRepayments } from '../hooks'

type Period = 'today' | 'week' | 'month' | 'all'
type Tab = 'debiteurs' | 'credits' | 'paiements' | 'echeances'
const PERIODS: Period[] = ['today', 'week', 'month', 'all']
const TABS: { id: Tab; label: 'debtors' | 'credits' | 'repayments' | 'installments' }[] = [
  { id: 'debiteurs', label: 'debtors' },
  { id: 'credits', label: 'credits' },
  { id: 'paiements', label: 'repayments' },
  { id: 'echeances', label: 'installments' },
]

/** Début de période au fuseau de l'espace (Africa/Abidjan = UTC, §7.10). */
function periodFrom(period: Period): string | undefined {
  if (period === 'all') return undefined
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const days = period === 'today' ? 0 : period === 'week' ? 6 : 29
  return new Date(d.getTime() - days * 86_400_000).toISOString()
}

/** « Mes crédits clients » (M09) : qui doit combien, ce qui est rentré, ce qui est en retard. */
export function CreditsPage() {
  const { t } = useTranslation()
  const can = useCan()
  const navigate = useNavigate()
  const { shop } = useCurrentShop()
  const list = useListParams(['vue', 'periode', 'client'])
  const tab: Tab = (TABS.map((x) => x.id) as string[]).includes(list.filter.vue ?? '') ? (list.filter.vue as Tab) : 'debiteurs'
  const period: Period = (PERIODS as string[]).includes(list.filter.periode ?? '') ? (list.filter.periode as Period) : 'month'
  const from = periodFrom(period)
  const summary = useCreditsSummary(shop?.id, { from })
  const [picker, setPicker] = useState(false)
  const [opening, setOpening] = useState(false)

  // Lien depuis la fiche client (« Enregistrer un remboursement ») : on va droit au paiement.
  if (list.filter.client) return <Navigate to={`/credits/clients/${list.filter.client}/paiement`} replace />

  const setTab = (id: Tab) => list.setFilter('vue', id === 'debiteurs' ? undefined : id)
  const s = summary.data

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('credits.title')}
        subtitle={t('credits.subtitle', { shop: shop?.name ?? '' })}
        actions={
          <div className="flex flex-wrap gap-2">
            {can('repayments.create') && (
              <Button variant="action" onClick={() => setPicker(true)}>
                <HandCoins aria-hidden="true" />
                {t('credits.repay')}
              </Button>
            )}
            {can('credits.opening_balance') && (
              <Button variant="outline" onClick={() => setOpening(true)}>
                <FilePlus2 aria-hidden="true" />
                {t('credits.opening')}
              </Button>
            )}
          </div>
        }
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('credits.period')}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => list.setFilter('periode', p === 'month' ? undefined : p)}
            className={cn('min-h-10 shrink-0 rounded-sm border-2 border-foreground px-3 text-sm font-bold whitespace-nowrap', period === p ? 'bg-foreground text-background' : 'bg-card')}
          >
            {t(`credits.periods.${p}`)}
          </button>
        ))}
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card icon={WalletCards} label={t('credits.cards.remaining')} active={tab === 'debiteurs'} onClick={() => setTab('debiteurs')}>
            <Money value={s.remaining_total} size="md" className="text-destructive" />
            <span className="text-xs text-muted-foreground">{t('credits.cards.debtors', { count: s.debtors_count })}</span>
          </Card>
          <Card icon={Users} label={t('credits.cards.new_credits')} active={tab === 'credits'} onClick={() => setTab('credits')}>
            <Money value={s.new_credits.amount} size="md" />
            <span className="text-xs text-muted-foreground">{t('credits.cards.count', { count: s.new_credits.count })}</span>
          </Card>
          <Card icon={Wallet} label={t('credits.cards.repayments')} active={tab === 'paiements'} onClick={() => setTab('paiements')}>
            <Money value={s.repayments.amount} size="md" className="text-paid-ink" />
            <span className="text-xs text-muted-foreground">{t('credits.cards.count', { count: s.repayments.count })}</span>
          </Card>
          <Card icon={AlarmClock} label={t('credits.cards.overdue')} active={tab === 'echeances'} onClick={() => setTab('echeances')} tone={s.overdue_installments.count > 0 ? 'danger' : undefined}>
            <Money value={s.overdue_installments.amount} size="md" className={s.overdue_installments.count > 0 ? 'text-destructive' : undefined} />
            <span className="text-xs text-muted-foreground">{t('credits.cards.count', { count: s.overdue_installments.count })}</span>
          </Card>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b-2 border-foreground" role="tablist" aria-label={t('credits.tabs.label')}>
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={cn('-mb-0.5 min-h-11 shrink-0 rounded-t-sm border-2 border-b-0 px-4 text-sm font-bold whitespace-nowrap', tab === x.id ? 'border-foreground bg-card' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t(`credits.tabs.${x.label}`)}
          </button>
        ))}
      </div>

      {!can('records.view_all') && tab !== 'debiteurs' && (
        <p className="flex gap-2 rounded-sm bg-muted p-3 text-sm">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t('credits.own_only')}
        </p>
      )}

      {tab === 'debiteurs' && <DebtorsTab />}
      {tab === 'credits' && <CreditsTab from={from} />}
      {tab === 'paiements' && <RepaymentsTab from={from} />}
      {tab === 'echeances' && <InstallmentsTab />}

      <CustomerPicker open={picker} onOpenChange={setPicker} onPick={(c) => navigate(`/credits/clients/${c.id}/paiement`)} />
      {opening && <OpeningBalanceSheet open onOpenChange={setOpening} />}
    </div>
  )
}

function Card({ icon: Icon, label, active, onClick, tone, children }: { icon: typeof Users; label: string; active: boolean; onClick: () => void; tone?: 'danger'; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn('pressable-lg grid content-start gap-1 rounded-lg p-4 text-left', active ? 'bg-tint-lavender' : 'bg-card')}>
      <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className={cn('size-5', tone === 'danger' && 'text-destructive')} aria-hidden="true" />
        {label}
      </span>
      {children}
    </button>
  )
}

function DebtorsTab() {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const list = useListParams(['vue', 'periode'])
  const debtors = useDebtors(shop?.id, { page: list.page, search: list.params.search })

  return (
    <>
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('credits.search_debtors')} />
      {debtors.isPending ? (
        <LoadingState rows={5} />
      ) : debtors.isError ? (
        <ErrorState error={debtors.error} onRetry={() => void debtors.refetch()} />
      ) : debtors.data.data.length === 0 ? (
        list.search ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : (
          <EmptyState icon={WalletCards} title={t('credits.debtors_empty_title')} text={t('credits.debtors_empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('credits.tabs.debtors')}
            items={debtors.data.data}
            getKey={(d) => d.customer.id}
            to={(d) => `/credits/clients/${d.customer.id}`}
            columns={[
              { header: t('credits.columns.customer'), cell: (d) => d.customer.name },
              { header: t('credits.columns.phone'), cell: (d) => d.customer.phone ?? '—', className: 'tabular text-muted-foreground' },
              { header: t('credits.columns.credit_total'), cell: (d) => <Money value={d.credit_total} /> },
              { header: t('credits.columns.repaid'), cell: (d) => <Money value={d.repaid_total} className="text-paid-ink" /> },
              { header: t('credits.columns.balance'), cell: (d) => <Money value={d.balance} className="text-destructive" /> },
              { header: t('credits.columns.last'), cell: (d) => (d.last_operation_at ? formatShortDate(d.last_operation_at) : '—'), className: 'text-muted-foreground' },
            ]}
            card={(d) => (
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0">
                  <span className="truncate text-base font-bold">{d.customer.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {[d.customer.phone, d.last_operation_at && t('credits.last_operation', { date: formatShortDate(d.last_operation_at) })].filter(Boolean).join(' · ')}
                  </span>
                  {Number(d.credit_note_balance) > 0 && (
                    <span className="text-sm font-semibold text-primary">{t('credits.credit_note', { amount: Number(d.credit_note_balance).toLocaleString('fr-FR') })}</span>
                  )}
                </div>
                <div className="grid shrink-0 justify-items-end">
                  <span className="text-xs font-semibold text-muted-foreground">{t('credits.columns.balance')}</span>
                  <Money value={d.balance} className="text-destructive" />
                </div>
              </div>
            )}
          />
          <Pagination page={debtors.data.meta.current_page} lastPage={debtors.data.meta.last_page} total={debtors.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </>
  )
}

function CreditsTab({ from }: { from?: string }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const list = useListParams(['vue', 'periode'])
  const credits = useCreditList(shop?.id, { page: list.page, search: list.params.search, filter: { from } })

  return (
    <>
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('credits.search_credits')} />
      {credits.isPending ? (
        <LoadingState rows={5} />
      ) : credits.isError ? (
        <ErrorState error={credits.error} onRetry={() => void credits.refetch()} />
      ) : credits.data.data.length === 0 ? (
        <EmptyState title={t('credits.credits_empty')} />
      ) : (
        <>
          <DataList
            label={t('credits.tabs.credits')}
            items={credits.data.data}
            getKey={(c) => c.id}
            to={(c) => `/credits/clients/${c.customer.id}`}
            columns={[
              { header: t('credits.columns.reference'), cell: (c) => (c.is_opening_balance ? `${t('credits.opening_balance')} ${c.reference}` : c.reference) },
              { header: t('credits.columns.date'), cell: (c) => formatShortDate(c.occurred_at), className: 'text-muted-foreground' },
              { header: t('credits.columns.customer'), cell: (c) => c.customer.name },
              { header: t('credits.columns.amount'), cell: (c) => <Money value={c.amount} /> },
              { header: t('credits.columns.remaining'), cell: (c) => <Money value={c.remaining_amount} className={Number(c.remaining_amount) > 0 ? 'text-destructive' : undefined} /> },
              { header: t('credits.columns.status'), cell: (c) => <CreditStatusBadge status={c.status} /> },
            ]}
            card={(c) => (
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    {c.customer.name} · {c.is_opening_balance ? t('credits.opening_balance') : c.reference}
                  </span>
                  <Money value={c.amount} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{formatShortDate(c.occurred_at)}</span>
                  <CreditStatusBadge status={c.status} />
                </div>
              </div>
            )}
          />
          <Pagination page={credits.data.meta.current_page} lastPage={credits.data.meta.last_page} total={credits.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </>
  )
}

function RepaymentsTab({ from }: { from?: string }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const list = useListParams(['vue', 'periode'])
  const repayments = useRepayments(shop?.id, { page: list.page, search: list.params.search, filter: { from } })

  return (
    <>
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('credits.search_credits')} />
      {repayments.isPending ? (
        <LoadingState rows={5} />
      ) : repayments.isError ? (
        <ErrorState error={repayments.error} onRetry={() => void repayments.refetch()} />
      ) : repayments.data.data.length === 0 ? (
        <EmptyState title={t('credits.repayments_empty')} />
      ) : (
        <>
          <DataList
            label={t('credits.tabs.repayments')}
            items={repayments.data.data}
            getKey={(r) => r.id}
            to={(r) => `/credits/paiements/${r.id}`}
            columns={[
              { header: t('credits.columns.reference'), cell: (r) => r.reference },
              { header: t('credits.columns.date'), cell: (r) => formatShortDate(r.received_at), className: 'text-muted-foreground' },
              { header: t('credits.columns.customer'), cell: (r) => r.customer.name },
              { header: t('credits.columns.method'), cell: (r) => r.method?.name ?? t('sales.detail.credit_note'), className: 'text-muted-foreground' },
              { header: t('credits.columns.amount'), cell: (r) => <Money value={r.amount} className={r.status === 'cancelled' ? 'line-through opacity-60' : 'text-paid-ink'} /> },
              {
                header: t('credits.columns.status'),
                cell: (r) => <StatusBadge tone={r.status === 'completed' ? 'paid' : r.status === 'pending' ? 'warn' : 'neutral'}>{t(`credits.repayment_detail.${r.status}`)}</StatusBadge>,
              },
            ]}
            card={(r) => (
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0">
                  <span className="truncate font-bold">
                    {r.customer.name} · {r.reference}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatShortDate(r.received_at)} · {r.method?.name ?? t('sales.detail.credit_note')}
                  </span>
                </div>
                <Money value={r.amount} className={r.status === 'cancelled' ? 'line-through opacity-60' : 'text-paid-ink'} />
              </div>
            )}
          />
          <Pagination page={repayments.data.meta.current_page} lastPage={repayments.data.meta.last_page} total={repayments.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </>
  )
}

/** Échéances en retard puis à venir (7 jours). GStock ne relance jamais le client (§7.7). */
function InstallmentsTab() {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const overdue = useInstallments(shop?.id, 'overdue')
  const upcoming = useInstallments(shop?.id, 'upcoming')

  if (overdue.isPending || upcoming.isPending) return <LoadingState rows={4} />
  if (overdue.isError) return <ErrorState error={overdue.error} onRetry={() => void overdue.refetch()} />
  const rows = [...overdue.data.data, ...(upcoming.data?.data ?? [])]
  if (rows.length === 0) return <EmptyState icon={AlarmClock} title={t('credits.installments_empty')} />

  return (
    <DataList
      label={t('credits.tabs.installments')}
      items={rows}
      getKey={(i) => i.id}
      to={(i) => `/credits/clients/${i.customer.id}`}
      columns={[
        { header: t('credits.columns.due_date'), cell: (i) => formatShortDate(i.due_date) },
        { header: t('credits.columns.customer'), cell: (i) => i.customer.name },
        { header: t('credits.columns.reference'), cell: (i) => i.credit.reference, className: 'text-muted-foreground' },
        { header: t('credits.columns.amount'), cell: (i) => <Money value={String(Number(i.amount) - Number(i.paid_amount))} /> },
        { header: t('credits.columns.status'), cell: (i) => <InstallmentStatusBadge status={i.status} /> },
      ]}
      card={(i) => (
        <div className="flex items-center justify-between gap-3">
          <div className="grid min-w-0">
            <span className="truncate font-bold">{i.customer.name}</span>
            <span className="text-sm text-muted-foreground">
              {formatShortDate(i.due_date)} · {i.credit.reference}
            </span>
          </div>
          <div className="grid shrink-0 justify-items-end gap-1">
            <Money value={String(Number(i.amount) - Number(i.paid_amount))} />
            <InstallmentStatusBadge status={i.status} />
          </div>
        </div>
      )}
    />
  )
}
