import { BarChart3, Clock, PackageSearch, ShoppingBasket, TrendingDown, TrendingUp, Truck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan, useSession } from '@/features/auth/hooks'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { useCurrentShop } from '@/features/shops/hooks'
import { articleKey } from '@/lib/articles'
import { formatDay, formatQuantity, formatShortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Id } from '@/types/api'
import type { DormantDays, ReportArticle, ReportQuery, RestockArticle, SoldArticle } from '@/types/reports'
import { CustomersTab } from '../components/CustomersTab'
import { ReportError, Section, Segmented, Tile } from '../components/ReportParts'
import { SalesChart } from '../components/SalesChart'
import { useProductsReport, useSalesReport } from '../hooks'
import { PRESETS, presetRange, today, type PeriodPreset } from '../period'

type Tab = 'ventes' | 'produits' | 'clients'

const TABS: Tab[] = ['ventes', 'produits', 'clients']

/** Rapports, première partie (M15) : ventes et produits, sur une période, une boutique ou toutes (propriétaire). */
export function ReportsPage() {
  const { t } = useTranslation()
  const { role, shops } = useSession()
  const { shop } = useCurrentShop()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((x) => x === params.get('onglet')) ?? 'ventes'
  const [preset, setPreset] = useState<PeriodPreset>('30d')
  const [custom, setCustom] = useState<ReportQuery>(() => presetRange('30d'))
  // « Toutes mes boutiques » : propriétaire avec plusieurs boutiques (§3.6).
  const canSeeAll = role.is_owner && shops.length > 1
  const [all, setAll] = useState(false)
  const shopId: Id | null | undefined = all && canSeeAll ? null : shop?.id
  const query = preset === 'custom' ? custom : presetRange(preset)

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('reports.title')}
        subtitle={all && canSeeAll ? t('reports.subtitle_all') : t('reports.subtitle', { shop: shop?.name ?? '' })}
      />

      {/* Filtres : une seule rangée au-dessus de tout ce qu'ils règlent. */}
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label={t('reports.period.label')}>
            {PRESETS.map((p) => (
              <Chip key={p} active={preset === p} onClick={() => setPreset(p)}>
                {t(`reports.period.${p}`)}
              </Chip>
            ))}
          </div>
          {canSeeAll && (
            <Segmented
              label={t('home.scope')}
              value={all}
              onChange={setAll}
              options={[
                { value: false, label: t('home.scope_shop') },
                { value: true, label: t('home.scope_all') },
              ]}
            />
          )}
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              {t('reports.period.from')}
              <Input type="date" max={custom.to} value={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              {t('reports.period.to')}
              <Input type="date" min={custom.from} max={today()} value={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
            </label>
          </div>
        )}
      </div>

      <div className="inline-flex justify-self-start rounded-md border-2 border-foreground bg-card p-1" role="tablist" aria-label={t('reports.title')}>
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setParams((p) => (value === 'ventes' ? (p.delete('onglet'), p) : (p.set('onglet', value), p)), { replace: true })}
            className={cn('min-h-10 rounded-sm px-4 text-sm font-bold', tab === value ? 'bg-foreground text-background' : 'hover:bg-muted')}
          >
            {t(`reports.tabs.${value}`)}
          </button>
        ))}
      </div>

      {tab === 'ventes' ? (
        <SalesTab shopId={shopId} query={query} />
      ) : tab === 'produits' ? (
        <ProductsTab shopId={shopId} query={query} />
      ) : (
        <CustomersTab shopId={shopId} query={query} />
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('min-h-10 shrink-0 rounded-sm border-2 border-foreground px-3 text-sm font-bold whitespace-nowrap', active ? 'bg-foreground text-background' : 'bg-card')}
    >
      {children}
    </button>
  )
}

function SalesTab({ shopId, query }: { shopId: Id | null | undefined; query: ReportQuery }) {
  const { t } = useTranslation()
  const report = useSalesReport(shopId, query)
  const [details, setDetails] = useState(false)

  if (report.isPending) return <LoadingState rows={4} />
  if (report.isError) return <ReportError error={report.error} onRetry={() => void report.refetch()} />
  const r = report.data
  const pct = r.change_percent

  return (
    <div className={cn('grid gap-6', report.isFetching && 'opacity-70')}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t('reports.sales.total')}>
          <Money value={r.total} size="md" />
          {pct !== null && (
            <span className={cn('flex items-center gap-1 text-sm font-semibold', pct >= 0 ? 'text-paid-ink' : 'text-destructive')}>
              {pct >= 0 ? <TrendingUp className="size-4" aria-hidden="true" /> : <TrendingDown className="size-4" aria-hidden="true" />}
              {t('reports.sales.change', { sign: pct > 0 ? '+' : '', value: pct.toLocaleString('fr-FR') })}
            </span>
          )}
        </Tile>
        <Tile label={t('reports.sales.count')}>
          <span className="tabular text-[22px] leading-tight font-bold">{r.count.toLocaleString('fr-FR')}</span>
          <span className="text-sm text-muted-foreground">{t('reports.sales.items_per_sale', { value: Number(r.items_per_sale).toLocaleString('fr-FR') })}</span>
        </Tile>
        <Tile label={t('reports.sales.average_ticket')}>
          <Money value={r.average_ticket} size="md" />
          <span className="text-sm text-muted-foreground">{t('reports.sales.average_ticket_hint')}</span>
        </Tile>
        <Tile label={t('reports.sales.margin')}>
          <Money value={r.margin} size="md" className={Number(r.margin) < 0 ? 'text-destructive' : undefined} />
          <span className="text-sm text-muted-foreground">{t('reports.sales.cost_of_goods', { amount: Number(r.cost_of_goods).toLocaleString('fr-FR') })}</span>
          {!r.margin_complete && <span className="text-sm font-semibold text-warn">{t('reports.sales.margin_incomplete')}</span>}
        </Tile>
      </div>

      <Section icon={BarChart3} title={t('reports.sales.chart_title')} hint={t('reports.sales.chart_hint')}>
        {r.count === 0 ? (
          <EmptyState icon={BarChart3} title={t('reports.sales.empty_title')} text={t('reports.sales.empty_text')} />
        ) : (
          <>
            <SalesChart days={r.days} />
            {r.best_day && r.worst_day && (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="grid">
                  <dt className="text-muted-foreground">{t('reports.sales.best_day')}</dt>
                  <dd className="font-bold">
                    {formatDay(r.best_day.date)} · <Money value={r.best_day.total} />
                  </dd>
                </div>
                <div className="grid">
                  <dt className="text-muted-foreground">{t('reports.sales.worst_day')}</dt>
                  <dd className="font-bold">
                    {formatDay(r.worst_day.date)} · <Money value={r.worst_day.total} />
                  </dd>
                </div>
              </dl>
            )}
            {/* Le détail chiffré, lisible sans survoler le graphique. */}
            <button type="button" className="justify-self-start text-sm font-bold text-primary hover:underline" aria-expanded={details} onClick={() => setDetails((d) => !d)}>
              {details ? t('reports.sales.hide_days') : t('reports.sales.show_days')}
            </button>
            {details && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground text-left">
                    <th className="py-2 font-semibold">{t('reports.sales.day')}</th>
                    <th className="py-2 text-right font-semibold">{t('reports.sales.count')}</th>
                    <th className="py-2 text-right font-semibold">{t('reports.sales.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...r.days].reverse().map((d) => (
                    <tr key={d.date} className="border-b border-muted">
                      <td className="py-1.5">{formatDay(d.date)}</td>
                      <td className="tabular py-1.5 text-right">{d.count}</td>
                      <td className="py-1.5 text-right">
                        <Money value={d.total} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

type Ranking = 'revenue' | 'quantity' | 'margin'

function ProductsTab({ shopId, query }: { shopId: Id | null | undefined; query: ReportQuery }) {
  const { t } = useTranslation()
  const [dormantDays, setDormantDays] = useState<DormantDays>(60)
  const [ranking, setRanking] = useState<Ranking>('revenue')
  const report = useProductsReport(shopId, query, dormantDays)

  if (report.isPending) return <LoadingState rows={5} />
  if (report.isError) return <ReportError error={report.error} onRetry={() => void report.refetch()} />
  const r = report.data
  const ranked = [...r.sold]
    .filter((a) => ranking !== 'margin' || a.margin !== null)
    .sort((a, b) => Number(b[ranking] ?? 0) - Number(a[ranking] ?? 0))
    .slice(0, 10)
  const atLoss = r.sold.filter((a) => a.margin !== null && Number(a.margin) < 0)

  return (
    <div className={cn('grid gap-6', report.isFetching && 'opacity-70')}>
      <Section icon={ShoppingBasket} title={t('reports.products.top_title')} hint={t('reports.products.top_hint')}>
        <Segmented
          label={t('reports.products.rank_by')}
          value={ranking}
          onChange={setRanking}
          options={(['revenue', 'quantity', 'margin'] as const).map((v) => ({ value: v, label: t(`reports.products.rank.${v}`) }))}
        />
        {ranked.length === 0 ? (
          <p className="text-muted-foreground">{t('reports.products.top_empty')}</p>
        ) : (
          <ol className="grid gap-2">
            {ranked.map((a, i) => (
              <ArticleRow key={articleKey(a.product.id, a.variant?.id)} article={a} rank={i + 1}>
                <SoldFigures article={a} ranking={ranking} />
              </ArticleRow>
            ))}
          </ol>
        )}
      </Section>

      <Section icon={TrendingDown} title={t('reports.products.loss_title')} hint={t('reports.products.loss_hint')}>
        {atLoss.length === 0 && r.below_cost.length === 0 ? (
          <p className="text-muted-foreground">{t('reports.products.loss_empty')}</p>
        ) : (
          <ul className="grid gap-2">
            {atLoss.map((a) => (
              <ArticleRow key={`sold-${articleKey(a.product.id, a.variant?.id)}`} article={a}>
                <span className="grid justify-items-end">
                  <Money value={a.margin!} className="text-destructive" />
                  <span className="text-sm text-muted-foreground">{t('reports.products.loss_sold', { amount: Number(a.revenue).toLocaleString('fr-FR') })}</span>
                </span>
              </ArticleRow>
            ))}
            {r.below_cost.map((a) => (
              <ArticleRow key={`price-${articleKey(a.product.id, a.variant?.id)}`} article={a}>
                <span className="grid justify-items-end">
                  <StatusBadge tone="danger">{t('reports.products.below_cost')}</StatusBadge>
                  <span className="text-sm text-muted-foreground">
                    {t('reports.products.price_vs_cost', { price: Number(a.price).toLocaleString('fr-FR'), cost: Number(a.cost).toLocaleString('fr-FR') })}
                  </span>
                </span>
              </ArticleRow>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={Clock}
        title={t('reports.products.restock_title')}
        hint={t('reports.products.restock_hint', { days: r.restock.velocity_days, horizon: r.restock.horizon_days })}
      >
        {r.restock.items.length === 0 ? (
          <p className="text-muted-foreground">{t('reports.products.restock_empty')}</p>
        ) : (
          <RestockList items={r.restock.items} />
        )}
      </Section>

      <Section icon={PackageSearch} title={t('reports.products.dormant_title')} hint={t('reports.products.dormant_hint')}>
        <Segmented
          label={t('reports.products.dormant_since')}
          value={dormantDays}
          onChange={setDormantDays}
          options={([30, 60, 90] as const).map((d) => ({ value: d, label: t('reports.products.days', { count: d }) }))}
        />
        {r.dormant.count === 0 ? (
          <p className="text-muted-foreground">{t('reports.products.dormant_empty', { count: r.dormant.days })}</p>
        ) : (
          <>
            <p className="font-semibold">
              {t('reports.products.dormant_total', { count: r.dormant.count })} <Money value={r.dormant.value} />
            </p>
            <ul className="grid gap-2">
              {r.dormant.items.map((a) => (
                <ArticleRow key={articleKey(a.product.id, a.variant?.id)} article={a}>
                  <span className="grid justify-items-end text-right">
                    {a.value !== null ? <Money value={a.value} /> : <span className="text-sm text-muted-foreground">{t('reports.products.no_cost')}</span>}
                    <span className="text-sm text-muted-foreground">
                      {formatQuantity(a.quantity)} {a.product.unit?.short_name ?? ''} ·{' '}
                      {a.last_sold_at ? t('reports.products.last_sold', { date: formatShortDate(a.last_sold_at) }) : t('reports.products.never_sold')}
                    </span>
                  </span>
                </ArticleRow>
              ))}
            </ul>
          </>
        )}
      </Section>
    </div>
  )
}

/** « À racheter bientôt » : en liste (avec le fournisseur habituel) ou regroupé par fournisseur, avec « Racheter chez lui ». */
function RestockList({ items }: { items: RestockArticle[] }) {
  const { t } = useTranslation()
  const can = useCan()
  const [bySupplier, setBySupplier] = useState(false)
  const row = (a: RestockArticle, withSupplier: boolean) => {
    const unit = a.product.unit?.short_name ?? ''
    return (
      <ArticleRow key={articleKey(a.product.id, a.variant?.id)} article={a} sub={withSupplier && a.supplier ? t('reports.products.at_supplier', { name: a.supplier.name }) : undefined}>
        <span className="grid justify-items-end gap-0.5 text-right">
          <StatusBadge tone={a.days_left === 0 ? 'danger' : a.days_left <= 7 ? 'warn' : 'neutral'}>
            {a.days_left === 0 ? t('reports.products.out_now') : t('reports.products.days_left', { count: a.days_left })}
          </StatusBadge>
          <span className="text-sm text-muted-foreground">
            {t('reports.products.stock_and_pace', { stock: `${formatQuantity(a.quantity)} ${unit}`, pace: `${formatQuantity(a.per_day)} ${unit}` })}
          </span>
          {Number(a.suggested_quantity) > 0 && (
            <span className="text-sm font-bold">{t('reports.products.suggested', { value: `${formatQuantity(a.suggested_quantity)} ${unit}` })}</span>
          )}
        </span>
      </ArticleRow>
    )
  }
  // Groupes dans l'ordre d'urgence de leur premier article ; « sans fournisseur connu » à la fin.
  const groups = [...items.reduce((m, a) => m.set(a.supplier?.id ?? null, [...(m.get(a.supplier?.id ?? null) ?? []), a]), new Map<number | null, RestockArticle[]>())]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : 0))

  return (
    <>
      <Segmented
        label={t('reports.products.restock_view')}
        value={bySupplier}
        onChange={setBySupplier}
        options={[
          { value: false, label: t('reports.products.restock_list') },
          { value: true, label: t('reports.products.restock_by_supplier') },
        ]}
      />
      {!bySupplier ? (
        <ul className="grid gap-2">{items.map((a) => row(a, true))}</ul>
      ) : (
        <div className="grid gap-5">
          {groups.map(([id, group]) => (
            <div key={id ?? 'none'} className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-foreground pb-2">
                <h3 className="font-bold">
                  {group[0]!.supplier?.name ?? t('reports.products.no_usual_supplier')}{' '}
                  <span className="font-semibold text-muted-foreground">· {t('reports.products.restock_count', { count: group.length })}</span>
                </h3>
                {id !== null && can('purchases.create') && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/approvisionnements/nouveau?fournisseur=${id}`}>
                      <Truck aria-hidden="true" />
                      {t('reports.products.restock_buy')}
                    </Link>
                  </Button>
                )}
              </div>
              <ul className="grid gap-2">{group.map((a) => row(a, false))}</ul>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** Ligne d'un article : vignette, nom (et variante, ou précision), chiffres à droite ; mène à la fiche du produit. */
function ArticleRow({ article: a, rank, sub, children }: { article: ReportArticle; rank?: number; sub?: string; children: ReactNode }) {
  return (
    <li>
      <Link to={`/produits/${a.product.id}`} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-muted">
        {rank !== undefined && <span className="tabular w-6 shrink-0 text-center text-sm font-extrabold text-muted-foreground">{rank}</span>}
        <ProductThumb name={a.product.name} color={a.product.category?.color} imageUrl={a.product.image_url} className="size-10" />
        <span className="grid min-w-0 flex-1">
          <span className="truncate font-bold">{a.product.name}</span>
          {a.variant && <span className="truncate text-sm text-muted-foreground">{a.variant.name}</span>}
          {sub && <span className="truncate text-sm text-muted-foreground">{sub}</span>}
        </span>
        {children}
      </Link>
    </li>
  )
}

function SoldFigures({ article: a, ranking }: { article: SoldArticle; ranking: Ranking }) {
  const { t } = useTranslation()
  const unit = a.product.unit?.short_name ?? ''
  const quantity = `${formatQuantity(a.quantity)} ${unit}`
  return (
    <span className="grid justify-items-end text-right">
      {ranking === 'quantity' ? (
        <span className="tabular font-bold">{quantity}</span>
      ) : ranking === 'margin' ? (
        <Money value={a.margin!} className={Number(a.margin) < 0 ? 'text-destructive' : undefined} />
      ) : (
        <Money value={a.revenue} />
      )}
      <span className="text-sm text-muted-foreground">
        {ranking === 'quantity'
          ? t('reports.products.revenue_short', { amount: Number(a.revenue).toLocaleString('fr-FR') })
          : a.margin === null
            ? t('reports.products.quantity_no_margin', { quantity })
            : t('reports.products.quantity_and_margin', { quantity, amount: Number(ranking === 'margin' ? a.revenue : a.margin).toLocaleString('fr-FR'), label: ranking === 'margin' ? t('reports.products.rank.revenue') : t('reports.products.rank.margin') })}
      </span>
    </span>
  )
}
