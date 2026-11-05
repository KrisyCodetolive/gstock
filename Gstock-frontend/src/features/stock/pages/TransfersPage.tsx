import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BackLink } from '@/components/BackLink'
import { DataList } from '@/components/DataList'
import { Pagination } from '@/components/ListControls'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan, useSession } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatDateTime, formatQuantity } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { cn } from '@/lib/utils'
import type { TransferStatus, TransferSummary } from '@/types/stock'
import { TransferStatusBadge } from '../components/TransferStatusBadge'
import { useTransfers } from '../hooks'

const FILTERS: (TransferStatus | undefined)[] = [undefined, 'in_transit', 'received', 'cancelled']

/** Transferts envoyés et reçus par la boutique courante (§7.12) ; les « en route » d'abord. */
export function TransfersPage() {
  const { t } = useTranslation()
  const can = useCan()
  const { shops } = useSession()
  const { shop } = useCurrentShop()
  const list = useListParams(['status'])
  const status = list.filter.status as TransferStatus | undefined
  const transfers = useTransfers(shop?.id, { page: list.page, filter: { status } })

  return (
    <div className="grid gap-6">
      <BackLink to="/stock" label={t('stock.back')} />
      <PageHeader
        title={t('stock.transfers.title')}
        subtitle={t('stock.transfers.subtitle', { shop: shop?.name ?? '' })}
        actions={
          can('stock.transfer') &&
          shops.length > 1 && (
            <Button asChild variant="action">
              <Link to="/stock/transferts/nouveau">
                <ArrowLeftRight aria-hidden="true" />
                {t('stock.transfers.new')}
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('stock.transfers.title')}>
        {FILTERS.map((value) => {
          const active = status === value
          return (
            <button
              key={value ?? 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => list.setFilter('status', value)}
              className={cn('min-h-10 rounded-md border-2 border-foreground px-4 text-sm font-bold', active ? 'bg-foreground text-background' : 'bg-card hover:bg-muted')}
            >
              {t(`stock.transfers.filters.${value ?? 'all'}`)}
            </button>
          )
        })}
      </div>

      {transfers.isPending ? (
        <LoadingState rows={4} />
      ) : transfers.isError ? (
        <ErrorState error={transfers.error} onRetry={() => void transfers.refetch()} />
      ) : transfers.data.data.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title={t('stock.transfers.empty_title')} text={t('stock.transfers.empty_text')} />
      ) : (
        <>
          <DataList
            label={t('stock.transfers.title')}
            items={transfers.data.data}
            getKey={(x) => x.id}
            to={(x) => `/stock/transferts/${x.id}`}
            columns={[
              { header: t('stock.columns.product'), cell: (x) => <Route transfer={x} /> },
              { header: t('stock.columns.quantity'), cell: (x) => `${t('stock.transfers.lines', { count: x.lines })} · ${formatQuantity(x.quantity)}`, className: 'tabular' },
              { header: t('stock.columns.state'), cell: (x) => <TransferStatusBadge status={x.status} direction={x.direction} /> },
            ]}
            card={(x) => (
              <div className="flex items-center gap-3">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <Route transfer={x} />
                  <span className="text-sm text-muted-foreground">
                    {t('stock.transfers.lines', { count: x.lines })} · {formatDateTime(x.sent_at)}
                  </span>
                </span>
                <TransferStatusBadge status={x.status} direction={x.direction} />
              </div>
            )}
          />
          <Pagination page={transfers.data.meta.current_page} lastPage={transfers.data.meta.last_page} total={transfers.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}

/** « TR-3 · Vers Boutique Yopougon », avec le sens en icône. */
function Route({ transfer: x }: { transfer: TransferSummary }) {
  const { t } = useTranslation()
  const Icon = x.direction === 'out' ? ArrowUpRight : ArrowDownLeft
  return (
    <span className="flex items-center gap-2 font-bold">
      <Icon className={cn('size-5 shrink-0', x.direction === 'out' ? 'text-destructive' : 'text-paid-ink')} aria-hidden="true" />
      <span className="truncate">
        {x.reference} ·{' '}
        {x.direction === 'out' ? t('stock.transfers.direction_out', { shop: x.to_shop.name }) : t('stock.transfers.direction_in', { shop: x.from_shop.name })}
      </span>
    </span>
  )
}
