import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FormSection } from '@/components/FormLayout'
import { SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { ErrorState, LoadingState } from '@/components/states'
import { useCan } from '@/features/auth/hooks'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { StockStateBadge } from '@/features/products/components/StockStateBadge'
import { useCurrentShop } from '@/features/shops/hooks'
import { articleKey } from '@/lib/articles'
import { formatQuantity, formatShortDate } from '@/lib/format'
import { normalizeText } from '@/lib/text'
import { useSupplierProducts } from '../hooks'
import { PriceTrend } from './PriceTrend'

/**
 * Produits achetés chez ce fournisseur (M11), déduits de ses approvisionnements : dernier prix,
 * évolution, quantités, stock de la boutique courante. Les prix d'achat demandent purchases.view.
 */
export function SupplierProductsSection({ supplierId }: { supplierId: number }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const allowed = can('purchases.view')
  const products = useSupplierProducts(supplierId, shop?.id, allowed)
  const [search, setSearch] = useState('')
  if (!allowed) return null
  const needle = normalizeText(search)
  const items = products.data?.filter((p) => !needle || normalizeText(`${p.product.name} ${p.variant?.name ?? ''}`).includes(needle)) ?? []

  return (
    <FormSection title={t('suppliers.catalog.title')} description={t('suppliers.catalog.hint', { shop: shop?.name ?? '' })}>
      {products.isPending ? (
        <LoadingState rows={3} />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : products.data.length === 0 ? (
        <p className="text-muted-foreground">{t('suppliers.catalog.empty')}</p>
      ) : (
        <>
          {products.data.length > 5 && <SearchInput value={search} onChange={setSearch} placeholder={t('suppliers.catalog.search')} />}
          <p className="text-sm font-semibold text-muted-foreground">{t('suppliers.catalog.count', { count: products.data.length })}</p>
          <ul className="grid divide-y-2 divide-muted">
            {items.map((p) => {
              const unit = p.product.unit?.short_name ?? ''
              const boughtIn = p.last_unit && p.last_unit.id !== p.product.unit?.id ? p.last_unit : null
              return (
                <li key={articleKey(p.product.id, p.variant?.id)}>
                  <Link to={`/produits/${p.product.id}`} className="flex items-start gap-3 rounded-md px-1 py-3 hover:bg-muted">
                    <ProductThumb name={p.product.name} color={p.product.category?.color} imageUrl={p.product.image_url} className="size-10" />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate font-bold">
                        {p.product.name}
                        {p.variant && <span className="font-semibold text-muted-foreground"> · {p.variant.name}</span>}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t('suppliers.catalog.bought', { count: p.purchases, quantity: `${formatQuantity(p.quantity)} ${unit}`, date: formatShortDate(p.last_purchased_at) })}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        {p.stock ? (
                          <>
                            <span className="text-muted-foreground">{t('suppliers.catalog.stock', { value: `${formatQuantity(p.stock.quantity)} ${unit}` })}</span>
                            {p.stock.state !== 'ok' && <StockStateBadge state={p.stock.state} />}
                          </>
                        ) : (
                          <span className="text-muted-foreground">{t('suppliers.catalog.no_stock')}</span>
                        )}
                      </span>
                    </span>
                    <span className="grid shrink-0 justify-items-end gap-0.5 text-right">
                      {boughtIn ? (
                        <>
                          <span>
                            <Money value={p.last_unit_cost} /> <span className="text-sm text-muted-foreground">/ {boughtIn.short_name}</span>
                          </span>
                          <span className="text-sm text-muted-foreground">{t('suppliers.catalog.per_base', { amount: Number(p.last_cost).toLocaleString('fr-FR'), unit })}</span>
                        </>
                      ) : (
                        <span>
                          <Money value={p.last_cost} /> {unit && <span className="text-sm text-muted-foreground">/ {unit}</span>}
                        </span>
                      )}
                      <PriceTrend last={p.last_cost} previous={p.previous_cost} />
                      {p.min_cost !== p.max_cost && (
                        <span className="text-xs text-muted-foreground">
                          {t('suppliers.catalog.range', { min: Number(p.min_cost).toLocaleString('fr-FR'), max: Number(p.max_cost).toLocaleString('fr-FR') })}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {items.length === 0 && <p className="text-muted-foreground">{t('list.no_result_title')}</p>}
        </>
      )}
    </FormSection>
  )
}
