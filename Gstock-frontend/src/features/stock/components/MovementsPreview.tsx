import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatDateTime, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Id } from '@/types/api'
import type { StockMovement } from '@/types/stock'
import { useMovements } from '../hooks'

/** Lien vers l'opération d'origine d'un mouvement, quand elle a un écran. */
function movementLink(m: StockMovement): string | null {
  if ((m.source_type === 'adjustment' || m.source_type === 'adjustment_cancel') && m.source_id) return `/stock/operations/${m.source_id}`
  if ((m.source_type === 'purchase' || m.source_type === 'purchase_cancel') && m.source_id) return `/approvisionnements/${m.source_id}`
  if ((m.source_type === 'sale' || m.source_type === 'sale_cancel') && m.source_id) return `/ventes/${m.source_id}`
  return null
}

/** Une ligne de l'historique : entrée en vert (+), sortie en rouge (−), stock restant. */
export function MovementRow({ movement: m, showProduct = true }: { movement: StockMovement; showProduct?: boolean }) {
  const { t } = useTranslation()
  const positive = Number(m.quantity) > 0
  const Icon = positive ? ArrowDownLeft : ArrowUpRight
  const link = movementLink(m)

  const content = (
    <>
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-sm border-2 border-foreground',
          positive ? 'bg-tint-mint text-paid-ink' : 'bg-destructive-bg text-destructive',
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" strokeWidth={2.6} />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-bold">{showProduct ? m.product.name : t(`stock.movements.sources.${m.source_type}`)}</span>
        <span className="truncate text-sm text-muted-foreground">
          {[
            showProduct ? t(`stock.movements.sources.${m.source_type}`) : null,
            m.reference,
            m.reason && m.reason !== t(`stock.movements.sources.${m.source_type}`) ? m.reason : null,
            formatDateTime(m.occurred_at),
            m.user ? t('stock.movements.by', { name: m.user.name }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="grid shrink-0 justify-items-end">
        <span className={cn('tabular text-base font-extrabold', positive ? 'text-paid-ink' : 'text-destructive')}>
          {positive ? '+' : '−'}
          {formatQuantity(Math.abs(Number(m.quantity)))} {m.product.unit.short_name}
        </span>
        <span className="tabular text-xs text-muted-foreground">{t('stock.movements.balance', { value: formatQuantity(m.balance) })}</span>
      </span>
      {link && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  )

  return link ? (
    <Link to={link} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-2 py-2">{content}</div>
  )
}

/** Les derniers mouvements d'un produit dans la boutique courante (fiche produit). */
export function MovementsPreview({ productId }: { productId: Id }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const movements = useMovements(shop?.id, { productId, per_page: 5 })

  if (movements.isPending) return <LoadingState rows={2} />
  if (movements.isError) return <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />
  if (movements.data.data.length === 0) return <EmptyState title={t('stock.movements.empty_title')} />
  return (
    <ul className="grid divide-y-2 divide-muted">
      {movements.data.data.map((m) => (
        <li key={m.id}>
          <MovementRow movement={m} showProduct={false} />
        </li>
      ))}
    </ul>
  )
}
