import { History, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BackLink } from '@/components/BackLink'
import { Pagination } from '@/components/ListControls'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { useProduct } from '@/features/products/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { useListParams } from '@/lib/use-list-params'
import { MovementRow } from '../components/MovementsPreview'
import { useMovements } from '../hooks'

/** Historique des mouvements de la boutique, éventuellement d'un seul produit. */
export function MovementsPage() {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const list = useListParams(['product_id'])
  const productId = list.filter.product_id ? Number(list.filter.product_id) : undefined
  const product = useProduct(productId)
  const movements = useMovements(shop?.id, { page: list.page, productId })

  return (
    <div className="grid gap-6">
      <BackLink to={productId ? `/produits/${productId}` : '/stock'} label={productId ? (product.data?.name ?? t('products.back')) : t('stock.back')} />
      <PageHeader
        title={t('stock.movements.title')}
        subtitle={product.data ? t('stock.movements.for_product', { name: product.data.name }) : t('stock.movements.subtitle', { shop: shop?.name ?? '' })}
        actions={
          productId && (
            <Button asChild variant="outline" size="sm">
              <Link to="/stock/mouvements">
                <X aria-hidden="true" />
                {t('stock.movements.all_products')}
              </Link>
            </Button>
          )
        }
      />
      {!can('records.view_all') && (
        <p className="flex gap-2 rounded-sm bg-muted p-3 text-sm">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t('stock.movements.own_only')}
        </p>
      )}

      {movements.isPending ? (
        <LoadingState rows={6} />
      ) : movements.isError ? (
        <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />
      ) : movements.data.data.length === 0 ? (
        <EmptyState icon={History} title={t('stock.movements.empty_title')} text={t('stock.movements.empty_text')} />
      ) : (
        <>
          <ul className="grid divide-y-2 divide-muted rounded-lg border-2 border-foreground bg-card p-2 shadow-hard">
            {movements.data.data.map((m) => (
              <li key={m.id}>
                <MovementRow movement={m} showProduct={!productId} />
              </li>
            ))}
          </ul>
          <Pagination page={movements.data.meta.current_page} lastPage={movements.data.meta.last_page} total={movements.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}
