import { AlertTriangle, ArchiveX, ArrowLeftRight, Boxes, CalendarClock, CalendarX, ClipboardCheck, History, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan, useSession } from '@/features/auth/hooks'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { StockStateBadge } from '@/features/products/components/StockStateBadge'
import { useCurrentShop } from '@/features/shops/hooks'
import { articleKey } from '@/lib/articles'
import { formatDay, formatQuantity } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { cn } from '@/lib/utils'
import type { StockItem, StockSummary } from '@/types/stock'
import { TransfersToReceive } from '../components/TransfersToReceive'
import { useShopStock, useStockOverview } from '../hooks'

/** low, out : état du stock ; expired, soon : péremption (§7.11). */
type StateFilter = 'low' | 'out' | 'expired' | 'soon' | undefined

const isExpiryFilter = (s: StateFilter) => s === 'expired' || s === 'soon'

export function StockPage() {
  const { t } = useTranslation()
  const can = useCan()
  const { role, shops } = useSession()
  const { shop } = useCurrentShop()
  const list = useListParams(['state', 'vue'])
  // Vue « Toutes mes boutiques » réservée au propriétaire (M07).
  const allShopsAvailable = role.is_owner && shops.length > 1
  const allShops = allShopsAvailable && list.filter.vue === 'toutes'
  const state = (list.filter.state as StateFilter) ?? undefined

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('stock.title')}
        subtitle={allShops ? t('stock.subtitle_all') : t('stock.subtitle', { shop: shop?.name ?? '' })}
        actions={
          // Les mouvements portent sur une boutique : pas d'action dans la vue globale.
          !allShops && <div className="flex flex-wrap gap-2">
            {can('stock.entry') && (
              <Button asChild variant="action">
                <Link to="/stock/entree">
                  <Plus strokeWidth={2.6} aria-hidden="true" />
                  {t('stock.actions.entry')}
                </Link>
              </Button>
            )}
            {can('stock.exit') && (
              <Button asChild variant="outline">
                <Link to="/stock/sortie">
                  <Minus strokeWidth={2.6} aria-hidden="true" />
                  {t('stock.actions.exit')}
                </Link>
              </Button>
            )}
            {can('stock.adjust') && (
              <Button asChild variant="outline">
                <Link to="/stock/inventaire">
                  <ClipboardCheck aria-hidden="true" />
                  {t('stock.actions.inventory')}
                </Link>
              </Button>
            )}
            {can('stock.transfer') && shops.length > 1 && (
              <Button asChild variant="outline">
                <Link to="/stock/transferts/nouveau">
                  <ArrowLeftRight aria-hidden="true" />
                  {t('stock.transfers.new')}
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link to="/stock/mouvements">
                <History aria-hidden="true" />
                {t('stock.actions.movements')}
              </Link>
            </Button>
            {shops.length > 1 && (
              <Button asChild variant="ghost">
                <Link to="/stock/transferts">
                  <ArrowLeftRight aria-hidden="true" />
                  {t('stock.transfers.list_link')}
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {!allShops && <TransfersToReceive />}

      {allShopsAvailable && (
        <div className="inline-flex justify-self-start rounded-md border-2 border-foreground bg-card p-1" role="group" aria-label={t('stock.view_label')}>
          {[
            { value: undefined, label: t('stock.view_shop') },
            { value: 'toutes', label: t('stock.view_all') },
          ].map((opt) => {
            const active = (list.filter.vue ?? undefined) === opt.value
            return (
              <button
                key={opt.label}
                type="button"
                aria-pressed={active}
                onClick={() => list.setFilter('vue', opt.value)}
                className={cn('min-h-10 rounded-sm px-4 text-sm font-bold', active ? 'bg-foreground text-background' : 'hover:bg-muted')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {allShops ? <OverviewList /> : <ShopStockList state={state} onState={(s) => list.setFilter('state', s)} />}
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  children,
  active,
  tone,
  onClick,
}: {
  icon: typeof Boxes
  label: string
  children: ReactNode
  active: boolean
  tone: 'neutral' | 'warn' | 'danger'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'pressable-lg grid gap-1 rounded-lg p-4 text-left',
        active ? 'bg-tint-lavender' : 'bg-card',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className={cn('size-5', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-destructive')} aria-hidden="true" />
        {label}
      </span>
      {children}
    </button>
  )
}

function Summary({ summary, state, onState }: { summary: StockSummary; state: StateFilter; onState: (s: StateFilter) => void }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <SummaryTile icon={Boxes} label={t('stock.summary.value')} active={!state} tone="neutral" onClick={() => onState(undefined)}>
        <Money value={summary.value} size="md" />
        <span className="text-xs text-muted-foreground">{t('stock.summary.products', { count: summary.products })}</span>
      </SummaryTile>
      <SummaryTile icon={AlertTriangle} label={t('stock.summary.low')} active={state === 'low'} tone="warn" onClick={() => onState(state === 'low' ? undefined : 'low')}>
        <span className="tabular text-[28px] leading-tight font-bold">{summary.low}</span>
      </SummaryTile>
      <SummaryTile icon={ArchiveX} label={t('stock.summary.out')} active={state === 'out'} tone="danger" onClick={() => onState(state === 'out' ? undefined : 'out')}>
        <span className="tabular text-[28px] leading-tight font-bold">{summary.out}</span>
      </SummaryTile>
      {/* Péremption : seulement si des produits suivis ont des dates proches ou dépassées. */}
      {(Boolean(summary.expired) || isExpiryFilter(state)) && (
        <SummaryTile icon={CalendarX} label={t('stock.filters.expired')} active={state === 'expired'} tone="danger" onClick={() => onState(state === 'expired' ? undefined : 'expired')}>
          <span className="tabular text-[28px] leading-tight font-bold">{summary.expired ?? 0}</span>
        </SummaryTile>
      )}
      {(Boolean(summary.soon) || isExpiryFilter(state)) && (
        <SummaryTile icon={CalendarClock} label={t('stock.filters.soon')} active={state === 'soon'} tone="warn" onClick={() => onState(state === 'soon' ? undefined : 'soon')}>
          <span className="tabular text-[28px] leading-tight font-bold">{summary.soon ?? 0}</span>
        </SummaryTile>
      )}
    </div>
  )
}

function ShopStockList({ state, onState }: { state: StateFilter; onState: (s: StateFilter) => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const list = useListParams(['state', 'vue'])
  const stock = useShopStock(shop?.id, { ...list.params, filter: isExpiryFilter(state) ? { expiry: state } : { state } })

  const qty = (i: StockItem) => (
    <span className="tabular font-bold">
      {formatQuantity(i.quantity)} <span className="text-sm font-semibold text-muted-foreground">{i.product.unit.short_name}</span>
    </span>
  )

  return (
    <>
      {stock.data && <Summary summary={stock.data.summary} state={state} onState={onState} />}
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('stock.search')} />
      {stock.isPending ? (
        <LoadingState rows={5} />
      ) : stock.isError ? (
        <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
      ) : stock.data.data.length === 0 ? (
        list.search ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : isExpiryFilter(state) ? (
          <EmptyState icon={CalendarClock} title={t('stock.expiry.empty_title')} text={t('stock.expiry.empty_text')} />
        ) : state ? (
          <EmptyState icon={Boxes} title={t('stock.alerts_empty_title')} text={t('stock.alerts_empty_text')} />
        ) : (
          <EmptyState icon={Boxes} title={t('stock.empty_title')} text={t('stock.empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('stock.title')}
            items={stock.data.data}
            getKey={(i) => articleKey(i.product.id, i.variant?.id)}
            to={(i) => `/produits/${i.product.id}`}
            columns={[
              {
                header: t('stock.columns.product'),
                cell: (i) => (
                  <span className="grid">
                    {i.product.name}
                    <ExpiryHint item={i} />
                  </span>
                ),
              },
              { header: t('stock.columns.quantity'), cell: qty },
              { header: t('stock.columns.alert'), cell: (i) => (i.stock_alert ? formatQuantity(i.stock_alert) : '—'), className: 'tabular text-muted-foreground' },
              { header: t('stock.columns.cost'), cell: (i) => (i.cost ? <Money value={i.cost} /> : '—') },
              { header: t('stock.columns.value'), cell: (i) => (i.value ? <Money value={i.value} /> : '—') },
              { header: t('stock.columns.state'), cell: (i) => <StockStateBadge state={i.state} /> },
            ]}
            card={(i) => (
              <div className="flex items-center gap-3">
                <ProductThumb name={i.product.name} color={i.product.category?.color} imageUrl={i.product.image_url} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-base font-bold">{i.product.name}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-sm">
                    {qty(i)}
                    {i.stock_alert && <span className="text-muted-foreground">{t('stock.alert_value', { value: formatQuantity(i.stock_alert) })}</span>}
                  </span>
                  <ExpiryHint item={i} />
                </div>
                {i.state !== 'ok' && <StockStateBadge state={i.state} />}
              </div>
            )}
          />
          <Pagination page={stock.data.meta.current_page} lastPage={stock.data.meta.last_page} total={stock.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </>
  )
}

/** Péremption d'une ligne (§7.11) : le périmé d'abord, sinon ce qui arrive à sa date. */
function ExpiryHint({ item }: { item: StockItem }) {
  const { t } = useTranslation()
  const e = item.expiry
  if (!e) return null
  const unit = item.product.unit.short_name
  if (Number(e.expired_quantity) > 0 && e.expired_since) {
    return (
      <span className="text-sm font-semibold text-destructive">
        {t('stock.expiry.expired_since', { value: `${formatQuantity(e.expired_quantity)} ${unit}`, date: formatDay(e.expired_since) })}
      </span>
    )
  }
  if (Number(e.soon_quantity) > 0 && e.next_expiry_date) {
    return (
      <span className="text-sm font-semibold text-warn">
        {t('stock.expiry.soon_until', { value: `${formatQuantity(e.soon_quantity)} ${unit}`, date: formatDay(e.next_expiry_date) })}
      </span>
    )
  }
  return null
}

/** Vue « Toutes mes boutiques » : une colonne par boutique, et le total. */
function OverviewList() {
  const { t } = useTranslation()
  const { shops } = useSession()
  const list = useListParams(['state', 'vue'])
  const overview = useStockOverview({ ...list.params }, true)

  return (
    <>
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('stock.search')} />
      {overview.isPending ? (
        <LoadingState rows={5} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : overview.data.data.length === 0 ? (
        <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
      ) : (
        <>
          <DataList
            label={t('stock.view_all')}
            items={overview.data.data}
            getKey={(r) => articleKey(r.product.id, r.variant?.id)}
            to={(r) => `/produits/${r.product.id}`}
            columns={[
              { header: t('stock.columns.product'), cell: (r) => r.product.name },
              ...shops.map((s) => ({
                header: s.name,
                cell: (r: (typeof overview.data.data)[number]) => {
                  const cell = r.shops.find((x) => x.shop_id === s.id)
                  return cell ? (
                    <span className={cn('tabular font-semibold', cell.state === 'out' && 'text-destructive', cell.state === 'low' && 'text-warn')}>
                      {formatQuantity(cell.quantity)}
                    </span>
                  ) : (
                    '—'
                  )
                },
              })),
              {
                header: t('stock.columns.total'),
                cell: (r) => (
                  <span className="tabular font-extrabold">
                    {formatQuantity(r.total)} {r.product.unit.short_name}
                  </span>
                ),
              },
            ]}
            card={(r) => (
              <div className="grid gap-1">
                <span className="font-bold">{r.product.name}</span>
                <span className="flex flex-wrap gap-x-4 text-sm">
                  {r.shops.map((cell) => (
                    <span key={cell.shop_id} className={cn(cell.state === 'out' && 'text-destructive', cell.state === 'low' && 'text-warn')}>
                      {shops.find((s) => s.id === cell.shop_id)?.name.replace('Boutique ', '')} :{' '}
                      <span className="tabular font-bold">{formatQuantity(cell.quantity)}</span>
                    </span>
                  ))}
                  <span className="font-bold">
                    {t('stock.columns.total')} : <span className="tabular">{formatQuantity(r.total)}</span> {r.product.unit.short_name}
                  </span>
                </span>
              </div>
            )}
          />
          <Pagination page={overview.data.meta.current_page} lastPage={overview.data.meta.last_page} total={overview.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </>
  )
}
