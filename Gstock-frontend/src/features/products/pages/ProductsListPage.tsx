import { Package, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ScanButton } from '@/components/BarcodeScanner'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCan } from '@/features/auth/hooks'
import { useReferentialList } from '@/features/referentials/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatQuantity } from '@/lib/format'
import i18n from '@/lib/i18n'
import { useListParams } from '@/lib/use-list-params'
import type { Product } from '@/types/catalog'
import { ProductThumb } from '../components/ProductThumb'
import { StockStateBadge } from '../components/StockStateBadge'
import { useProducts } from '../hooks'

const ALL = 'all'

export function ProductsListPage() {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const list = useListParams(['category_id'])
  const products = useProducts({ ...list.params, sort: 'name' }, shop?.id)
  const categories = useReferentialList('categories', { per_page: 100, sort: 'name' })
  const filtered = Boolean(list.search || list.filter.category_id)

  const name = (p: Product) => (
    <span className="inline-flex flex-wrap items-center gap-2">
      {p.name}
      {p.type === 'service' && <StatusBadge>{t('products.service')}</StatusBadge>}
      {!p.is_active && <StatusBadge>{t('products.inactive')}</StatusBadge>}
    </span>
  )
  const quantity = (p: Product) =>
    p.stock ? (
      <span className="tabular font-semibold">
        {formatQuantity(p.stock.quantity)} {p.unit.short_name}
      </span>
    ) : (
      <span className="text-muted-foreground">{t('products.no_stock_service')}</span>
    )

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        actions={
          can('products.create') && (
            <Button asChild variant="action">
              <Link to="/produits/nouveau">
                <Plus strokeWidth={2.6} aria-hidden="true" />
                {t('products.add')}
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex w-full gap-2 sm:max-w-sm">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('products.search')} />
          <ScanButton onDetected={list.setSearch} />
        </div>
        <div className="sm:w-64">
          <Select value={list.filter.category_id ?? ALL} onValueChange={(v) => list.setFilter('category_id', v === ALL ? undefined : v)}>
            <SelectTrigger aria-label={t('products.filter_category')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('products.all_categories')}</SelectItem>
              {categories.data?.data.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {products.isPending ? (
        <LoadingState rows={5} />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : products.data.data.length === 0 ? (
        filtered ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : (
          <EmptyState icon={Package} title={t('products.empty_title')} text={t('products.empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('products.title')}
            items={products.data.data}
            getKey={(p) => p.id}
            to={(p) => `/produits/${p.id}`}
            columns={[
              { header: t('products.columns.name'), cell: name },
              { header: t('products.columns.category'), cell: (p) => p.category?.name ?? '—', className: 'text-muted-foreground' },
              { header: t('products.columns.price'), cell: price, className: 'text-right' },
              { header: shop ? t('products.in_shop', { shop: shop.name }) : t('products.columns.quantity'), cell: quantity },
              { header: t('products.columns.state'), cell: (p) => p.stock && <StockStateBadge state={p.stock.state} /> },
            ]}
            card={(p) => (
              <div className="flex items-center gap-3">
                <ProductThumb name={p.name} color={p.category?.color} imageUrl={p.image_url} type={p.type} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-base leading-tight font-bold">{name(p)}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {price(p)}
                    {quantity(p)}
                  </span>
                </div>
                {p.stock && p.stock.state !== 'ok' && <StockStateBadge state={p.stock.state} />}
              </div>
            )}
          />
          <Pagination page={products.data.meta.current_page} lastPage={products.data.meta.last_page} total={products.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}

/** Prix d'un produit ; « à partir de » le plus bas prix pour un produit à variantes. */
function price(p: Product) {
  if (p.type !== 'variable') return <Money value={p.price} />
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs text-muted-foreground">{i18n.t('products.variants.from')}</span>
      <Money value={p.price} />
      <span className="text-xs text-muted-foreground">· {i18n.t('products.variants.count', { count: p.variants.length })}</span>
    </span>
  )
}
