import { ChevronRight, PackageSearch, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { articleKey } from '@/lib/articles'
import { formatQuantity } from '@/lib/format'
import type { Dashboard } from '@/types/dashboard'

/**
 * Rappel de l'accueil (M13) : articles dont le stock tient 7 jours ou moins au rythme des 30 derniers jours.
 * Chaque article ouvre sa fiche ; « Racheter chez lui » ouvre un approvisionnement (vue d'une boutique) ; « Tout voir » ouvre les rapports.
 */
export function RestockSoon({ restock, canBuy: inShop }: { restock: NonNullable<Dashboard['restock']>; canBuy: boolean }) {
  const { t } = useTranslation()
  const can = useCan()
  if (!can('stock.view')) return null
  // L'approvisionnement se fait dans une boutique : pas dans la vue « Toutes mes boutiques ».
  const canBuy = inShop && can('purchases.create')

  return (
    <section className="grid gap-3" aria-labelledby="restock-soon">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="restock-soon" className="text-xl font-bold">
          {t('home.restock.title', { count: restock.horizon_days })}
        </h2>
        {restock.count > 0 && can('reports.view') && (
          <Link to="/rapports?onglet=produits" className="flex min-h-10 items-center gap-1 text-sm font-bold underline-offset-4 hover:underline">
            {t('home.restock.see_all', { count: restock.count })}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {restock.count === 0 ? (
        <p className="text-muted-foreground">{t('home.restock.none', { count: restock.horizon_days })}</p>
      ) : (
        <div className="grid gap-2 rounded-lg border-2 border-foreground bg-card p-2">
          <p className="flex items-center gap-2 px-2 pt-1 font-semibold">
            <PackageSearch className="size-5 text-warn" aria-hidden="true" />
            {t('home.restock.count', { count: restock.count })}
          </p>
          <ul className="grid divide-y-2 divide-muted">
            {restock.items.map((a) => {
              const unit = a.product.unit?.short_name ?? ''
              const content = (
                <>
                  <ProductThumb name={a.product.name} color={a.product.category?.color} imageUrl={a.product.image_url} className="size-10" />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-bold">{a.variant ? `${a.product.name} · ${a.variant.name}` : a.product.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[t('home.restock.stock', { value: `${formatQuantity(a.quantity)} ${unit}`.trim() }), a.supplier?.name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <StatusBadge tone={a.days_left === 0 ? 'danger' : 'warn'}>
                    {a.days_left === 0 ? t('reports.products.out_now') : t('reports.products.days_left', { count: a.days_left })}
                  </StatusBadge>
                </>
              )
              return (
                <li key={articleKey(a.product.id, a.variant?.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                  <Link to={`/produits/${a.product.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                    {content}
                  </Link>
                  {canBuy && a.supplier && (
                    <Button asChild variant="outline" size="sm" className="ml-auto">
                      <Link to={`/approvisionnements/nouveau?fournisseur=${a.supplier.id}`} aria-label={t('home.restock.buy_from', { name: a.supplier.name })}>
                        <Truck aria-hidden="true" />
                        {t('reports.products.restock_buy')}
                      </Link>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
