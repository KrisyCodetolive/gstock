import { Info, Plus, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatShortDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import type { PurchaseListItem } from '@/types/purchases'
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge'
import { usePurchases } from '../hooks'

const ALL = 'all'

export function PurchasesListPage() {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const list = useListParams(['paiement'])
  const purchases = usePurchases(shop?.id, { page: list.page, search: list.params.search, filter: list.filter.paiement === 'en-retard' ? { overdue: 'true' } : { payment_status: list.filter.paiement } })
  const supplier = (p: PurchaseListItem) => p.supplier?.name ?? t('purchases.no_supplier')
  const total = (p: PurchaseListItem) => <Money value={p.total} className={p.status === 'cancelled' ? 'line-through opacity-60' : undefined} />

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle', { shop: shop?.name ?? '' })}
        actions={
          can('purchases.create') && (
            <Button asChild variant="action">
              <Link to="/approvisionnements/nouveau">
                <Plus strokeWidth={2.6} aria-hidden="true" />
                {t('purchases.add')}
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('purchases.search')} />
        <div className="sm:w-56">
          <Select value={list.filter.paiement ?? ALL} onValueChange={(v) => list.setFilter('paiement', v === ALL ? undefined : v)}>
            <SelectTrigger aria-label={t('purchases.filter_status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('purchases.all_statuses')}</SelectItem>
              {(['unpaid', 'partial', 'paid'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`purchases.payment_status.${s}`)}
                </SelectItem>
              ))}
              <SelectItem value="en-retard">{t('purchases.overdue')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {!can('records.view_all') && (
        <p className="flex gap-2 rounded-sm bg-muted p-3 text-sm">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t('purchases.own_only')}
        </p>
      )}
      {purchases.data && (
        <dl className="grid grid-cols-3 gap-3">
          {[
            { label: t('purchases.summary.total'), value: <Money value={purchases.data.summary.total} size="md" />, hint: t('purchases.summary.count', { count: purchases.data.summary.count }) },
            { label: t('purchases.summary.paid'), value: <Money value={purchases.data.summary.paid} size="md" className="text-paid-ink" /> },
            { label: t('purchases.summary.due'), value: <Money value={purchases.data.summary.due} size="md" className="text-destructive" /> },
          ].map((tile) => (
            <div key={tile.label} className="grid gap-1 rounded-lg border-2 border-foreground bg-card p-3">
              <dt className="text-sm font-semibold text-muted-foreground">{tile.label}</dt>
              <dd className="grid">
                {tile.value}
                {tile.hint && <span className="text-xs text-muted-foreground">{tile.hint}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {purchases.isPending ? (
        <LoadingState rows={4} />
      ) : purchases.isError ? (
        <ErrorState error={purchases.error} onRetry={() => void purchases.refetch()} />
      ) : purchases.data.data.length === 0 ? (
        <EmptyState icon={Truck} title={t('purchases.empty_title')} text={t('purchases.empty_text')} />
      ) : (
        <>
          <DataList
            label={t('purchases.title')}
            items={purchases.data.data}
            getKey={(p) => p.id}
            to={(p) => `/approvisionnements/${p.id}`}
            columns={[
              { header: t('purchases.columns.reference'), cell: (p) => p.reference },
              { header: t('purchases.columns.date'), cell: (p) => formatShortDate(p.occurred_at), className: 'text-muted-foreground' },
              { header: t('purchases.columns.supplier'), cell: supplier },
              { header: t('purchases.columns.total'), cell: total },
              { header: t('purchases.columns.due'), cell: (p) => (Number(p.due_amount) > 0 ? <Money value={p.due_amount} className="text-destructive" /> : '—') },
              { header: t('purchases.columns.status'), cell: (p) => <Badges purchase={p} /> },
            ]}
            card={(p) => (
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">
                    {p.reference} · {supplier(p)}
                  </span>
                  {total(p)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    {formatShortDate(p.occurred_at)} · {t('purchases.items', { count: p.items_count })}
                  </span>
                  <Badges purchase={p} />
                </div>
              </div>
            )}
          />
          <Pagination page={purchases.data.meta.current_page} lastPage={purchases.data.meta.last_page} total={purchases.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}

/** Statut de paiement, et « Échéance en retard » si une échéance dépassée n'est pas payée (§7.7). */
function Badges({ purchase: p }: { purchase: PurchaseListItem }) {
  const { t } = useTranslation()
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <PurchaseStatusBadge status={p.payment_status} purchaseStatus={p.status} />
      {Number(p.overdue_amount) > 0 && (
        <StatusBadge tone="danger">{t('purchases.overdue_amount', { amount: Number(p.overdue_amount).toLocaleString('fr-FR') })}</StatusBadge>
      )}
    </span>
  )
}
