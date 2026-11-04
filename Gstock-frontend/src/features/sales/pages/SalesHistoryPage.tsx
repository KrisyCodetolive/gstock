import { Info, ReceiptText, ShoppingCart, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { useUsers } from '@/features/users/hooks'
import { formatDateTime } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { cn } from '@/lib/utils'
import type { SaleListItem } from '@/types/sales'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { useSales } from '../hooks'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all'
const PERIODS: Period[] = ['today', 'yesterday', 'week', 'month', 'all']
const ALL = 'all'

/** Bornes d'une période, au fuseau de l'espace (Africa/Abidjan = UTC, §7.10). */
function periodRange(period: Period): { from?: string; to?: string } {
  const day = 86_400_000
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const t0 = startOfToday.getTime()
  switch (period) {
    case 'today':
      return { from: new Date(t0).toISOString() }
    case 'yesterday':
      return { from: new Date(t0 - day).toISOString(), to: new Date(t0 - 1).toISOString() }
    case 'week':
      return { from: new Date(t0 - 6 * day).toISOString() }
    case 'month':
      return { from: new Date(t0 - 29 * day).toISOString() }
    default:
      return {}
  }
}

export function SalesHistoryPage() {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const list = useListParams(['periode', 'paiement', 'vendeur', 'client'])
  const period = (PERIODS as string[]).includes(list.filter.periode ?? '') ? (list.filter.periode as Period) : 'week'
  const sales = useSales(shop?.id, {
    page: list.page,
    search: list.params.search,
    filter: {
      ...periodRange(period),
      payment_status: list.filter.paiement,
      user_id: list.filter.vendeur,
      customer_id: list.filter.client,
    },
  })
  // Filtre vendeur : seulement pour qui voit les ventes de tout le monde.
  const canFilterUsers = can('records.view_all') && can('users.manage')
  const users = useUsers({ per_page: 100, filter: { shop_id: shop?.id } }, canFilterUsers)

  const date = (s: SaleListItem) => formatDateTime(s.occurred_at)
  const customerName = (s: SaleListItem) => s.customer?.name ?? t('sales.history.no_customer')

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('sales.history.title')}
        subtitle={t('sales.history.subtitle', { shop: shop?.name ?? '' })}
        actions={
          can('sales.create') && (
            <Button asChild variant="action">
              <Link to="/vendre">
                <ShoppingCart strokeWidth={2.4} aria-hidden="true" />
                {t('sales.history.sell')}
              </Link>
            </Button>
          )
        }
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('sales.history.period')}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => list.setFilter('periode', p === 'week' ? undefined : p)}
            className={cn('min-h-10 shrink-0 rounded-sm border-2 border-foreground px-3 text-sm font-bold whitespace-nowrap', period === p ? 'bg-foreground text-background' : 'bg-card')}
          >
            {t(`sales.history.periods.${p}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('sales.history.search')} />
        <div className="sm:w-56">
          <Select value={list.filter.paiement ?? ALL} onValueChange={(v) => list.setFilter('paiement', v === ALL ? undefined : v)}>
            <SelectTrigger aria-label={t('sales.history.filter_status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('sales.history.all_statuses')}</SelectItem>
              {(['paid', 'partial', 'credit'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`sales.payment_status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canFilterUsers && users.data && (
          <div className="sm:w-56">
            <Select value={list.filter.vendeur ?? ALL} onValueChange={(v) => list.setFilter('vendeur', v === ALL ? undefined : v)}>
              <SelectTrigger aria-label={t('sales.history.filter_user')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('sales.history.all_users')}</SelectItem>
                {users.data.data.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.firstname} {u.lastname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {list.filter.client && (
          <Button variant="outline" size="sm" className="self-start sm:self-center" onClick={() => list.setFilter('client', undefined)} aria-label={t('sales.history.clear_customer')}>
            {sales.data?.data[0]?.customer?.name ? t('sales.history.customer_filter', { name: sales.data.data[0].customer.name }) : t('sales.history.clear_customer')}
            <X aria-hidden="true" />
          </Button>
        )}
      </div>

      {!can('records.view_all') && (
        <p className="flex gap-2 rounded-sm bg-muted p-3 text-sm">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t('sales.history.own_only')}
        </p>
      )}

      {sales.data && (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: t('sales.history.summary.total'), value: <Money value={sales.data.summary.total} size="md" />, hint: t('sales.history.summary.count', { count: sales.data.summary.count }) },
            { label: t('sales.history.summary.received'), value: <Money value={sales.data.summary.paid_now} size="md" className="text-paid-ink" /> },
            { label: t('sales.history.summary.credit'), value: <Money value={sales.data.summary.credit_amount} size="md" className="text-destructive" /> },
          ].map((tile) => (
            <div key={tile.label} className="grid gap-1 rounded-lg border-2 border-foreground bg-card p-4">
              <dt className="text-sm font-semibold text-muted-foreground">{tile.label}</dt>
              <dd className="grid">
                {tile.value}
                {tile.hint && <span className="text-xs text-muted-foreground">{tile.hint}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {sales.isPending ? (
        <LoadingState rows={6} />
      ) : sales.isError ? (
        <ErrorState error={sales.error} onRetry={() => void sales.refetch()} />
      ) : sales.data.data.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t('sales.history.empty_title')} text={t('sales.history.empty_text')} />
      ) : (
        <>
          <DataList
            label={t('sales.history.title')}
            items={sales.data.data}
            getKey={(s) => s.id}
            to={(s) => `/ventes/${s.id}`}
            columns={[
              { header: t('sales.history.columns.reference'), cell: (s) => s.reference },
              { header: t('sales.history.columns.date'), cell: date, className: 'text-muted-foreground' },
              { header: t('sales.history.columns.customer'), cell: customerName },
              { header: t('sales.history.columns.seller'), cell: (s) => s.user?.name ?? '—', className: 'text-muted-foreground' },
              { header: t('sales.history.columns.total'), cell: (s) => <Money value={s.total} className={s.status === 'cancelled' ? 'line-through opacity-60' : undefined} /> },
              { header: t('sales.history.columns.status'), cell: (s) => <PaymentStatusBadge status={s.payment_status} saleStatus={s.status} /> },
            ]}
            card={(s) => (
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold">
                    {s.reference} · {customerName(s)}
                  </span>
                  <Money value={s.total} className={s.status === 'cancelled' ? 'line-through opacity-60' : undefined} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {date(s)} · {t('sales.history.items', { count: s.items_count })}
                  </span>
                  <PaymentStatusBadge status={s.payment_status} saleStatus={s.status} />
                </div>
              </div>
            )}
          />
          <Pagination page={sales.data.meta.current_page} lastPage={sales.data.meta.last_page} total={sales.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}
