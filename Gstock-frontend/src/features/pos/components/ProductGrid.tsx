import { useTranslation } from 'react-i18next'
import { Money } from '@/components/Money'
import { ProductThumb } from '@/features/products/components/ProductThumb'
import { articleKey } from '@/lib/articles'
import { formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PosBootstrap } from '@/types/sales'

export type PosProduct = PosBootstrap['products'][number]

/**
 * Grille de la caisse (maquette « Marché ») : un toucher ajoute un article.
 * Rupture : carte atténuée, non ajoutable (§7.2).
 */
export function ProductGrid({
  products,
  quantities,
  onAdd,
}: {
  products: PosProduct[]
  quantities: Map<string, number>
  onAdd: (product: PosProduct) => void
}) {
  const { t } = useTranslation()
  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => {
        const inCart = quantities.get(articleKey(p.id, p.variant_id)) ?? 0
        const out = p.quantity !== null && Number(p.quantity) <= 0
        return (
          <li key={articleKey(p.id, p.variant_id)}>
            <button
              type="button"
              onClick={() => onAdd(p)}
              disabled={out}
              aria-label={`${p.name}, ${Number(p.price).toLocaleString('fr-FR')} FCFA${inCart ? `, ${t('sales.pos.in_cart', { count: inCart })}` : ''}`}
              className={cn(
                'pressable-lg relative grid h-full w-full content-start gap-1 rounded-md bg-card p-2 text-left disabled:opacity-50',
                inCart > 0 && 'bg-[color-mix(in_srgb,var(--card),var(--action)_8%)]',
              )}
            >
              {inCart > 0 && (
                <span className="absolute -top-2 -right-2 grid h-7 min-w-7 place-items-center rounded-full border-2 border-foreground bg-action px-1.5 text-sm font-extrabold text-action-foreground" aria-hidden="true">
                  {formatQuantity(inCart)}
                </span>
              )}
              <ProductThumb
                name={p.name}
                color={p.category?.color}
                imageUrl={p.image_url}
                type={p.type}
                className={cn('w-full rounded-sm', p.image_url ? 'aspect-[4/3] h-auto object-contain' : 'h-10')}
              />
              <span className="line-clamp-2 text-[13px] leading-tight font-bold">{p.name}</span>
              <Money value={p.price} />
              {p.quantity !== null && (
                <span
                  className={cn(
                    'text-xs',
                    out ? 'font-bold text-destructive' : p.state === 'low' ? 'font-bold text-warn' : 'text-muted-foreground',
                  )}
                >
                  {out ? t('sales.pos.out') : t('sales.pos.left', { value: `${formatQuantity(p.quantity)} ${p.unit.short_name}` })}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
