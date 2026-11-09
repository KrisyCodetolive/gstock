import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Money } from '@/components/Money'
import { Button } from '@/components/ui/button'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { StockStateBadge } from '@/features/products/components/StockStateBadge'
import { useCurrentShop } from '@/features/shops/hooks'
import { articleKey } from '@/lib/articles'
import { formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductSearchResult } from '@/types/catalog'
import { useSupplierArticles } from '../hooks'

/**
 * Racheter chez ce fournisseur (M11) : ses produits en stock faible ou en rupture dans la boutique,
 * à ajouter un par un ou tous d'un coup, au dernier prix et dans la dernière unité achetés chez lui.
 */
export function SupplierRestockPanel({ supplierId, taken, onAdd }: { supplierId: number; taken: string[]; onAdd: (items: ProductSearchResult[]) => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const [all, setAll] = useState(false)
  const articles = useSupplierArticles(shop?.id, supplierId, !all)
  const items = articles.data ?? []
  const free = items.filter((a) => !taken.includes(articleKey(a.id, a.variant_id)))

  if (articles.isPending || articles.isError) return null
  return (
    <div className="grid gap-3 rounded-md border-2 border-dashed border-foreground/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{all ? t('suppliers.restock.all_title') : t('suppliers.restock.title')}</p>
        <button type="button" className="text-sm font-bold text-primary hover:underline" onClick={() => setAll((a) => !a)}>
          {all ? t('suppliers.restock.only_low') : t('suppliers.restock.show_all')}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{all ? t('suppliers.restock.none_all') : t('suppliers.restock.none')}</p>
      ) : (
        <>
          <ul className="grid gap-2">
            {items.map((a) => {
              const key = articleKey(a.id, a.variant_id)
              const done = taken.includes(key)
              const unit = a.units.find((u) => u.id === a.supplier_last?.unit_id) ?? a.unit
              return (
                <li key={key} className={cn('flex items-center gap-3', done && 'opacity-60')}>
                  <ProductThumb name={a.name} color={a.category?.color} imageUrl={a.image_url} className="size-10" />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-bold">{a.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {a.quantity !== null && t('stock.picker.stock', { value: `${formatQuantity(a.quantity)} ${a.unit.short_name}` })}
                      {a.state && a.state !== 'ok' && <StockStateBadge state={a.state} />}
                    </span>
                  </span>
                  {a.supplier_last && (
                    <span className="hidden text-right text-sm sm:block">
                      <Money value={a.supplier_last.cost} /> <span className="text-muted-foreground">/ {unit.short_name}</span>
                    </span>
                  )}
                  <Button type="button" variant="outline" size="sm" disabled={done} onClick={() => onAdd([a])}>
                    {done ? t('stock.picker.already') : (
                      <>
                        <Plus strokeWidth={2.6} aria-hidden="true" />
                        {t('suppliers.restock.add')}
                      </>
                    )}
                  </Button>
                </li>
              )
            })}
          </ul>
          {free.length > 1 && (
            <Button type="button" variant="outline" className="justify-self-start" onClick={() => onAdd(free)}>
              <Plus strokeWidth={2.6} aria-hidden="true" />
              {t('suppliers.restock.add_all', { count: free.length })}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
