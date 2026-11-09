import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FormSection } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { useCan } from '@/features/auth/hooks'
import { formatShortDate } from '@/lib/format'
import { useProductSuppliers } from '../hooks'
import { PriceTrend } from './PriceTrend'

/**
 * Fiche produit : chez qui il a été acheté et à quel prix, du moins cher au plus cher (M11).
 * Les prix d'achat demandent purchases.view.
 */
export function ProductSuppliersSection({ productId, unit }: { productId: number; unit: string }) {
  const { t } = useTranslation()
  const can = useCan()
  const allowed = can('purchases.view')
  const suppliers = useProductSuppliers(productId, allowed)
  if (!allowed) return null

  return (
    <FormSection title={t('suppliers.catalog.product_title')} description={t('suppliers.catalog.product_hint')}>
      {suppliers.isPending ? (
        <LoadingState rows={2} />
      ) : suppliers.isError ? (
        <ErrorState error={suppliers.error} onRetry={() => void suppliers.refetch()} />
      ) : suppliers.data.length === 0 ? (
        <p className="text-muted-foreground">{t('suppliers.catalog.product_empty')}</p>
      ) : (
        <ul className="grid divide-y-2 divide-muted">
          {suppliers.data.map((s, i, all) => {
            const name = (
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-bold">
                  {s.supplier?.name ?? t('suppliers.catalog.no_supplier')}
                  {s.variant && <span className="font-semibold text-muted-foreground">· {s.variant.name}</span>}
                  {/* Le moins cher : premier de la liste, pour un produit sans variantes. */}
                  {i === 0 && all.length > 1 && s.supplier && !all.some((x) => x.variant) && <StatusBadge tone="paid">{t('suppliers.catalog.cheapest')}</StatusBadge>}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('suppliers.catalog.last_bought', { count: s.purchases, date: formatShortDate(s.last_purchased_at) })}
                </span>
              </span>
            )
            const price = (
              <span className="grid shrink-0 justify-items-end gap-0.5 text-right">
                <span>
                  <Money value={s.last_cost} /> {unit && <span className="text-sm text-muted-foreground">/ {unit}</span>}
                </span>
                {s.last_unit && s.last_unit.short_name !== unit && (
                  <span className="text-sm text-muted-foreground">
                    {t('suppliers.catalog.per_unit', { amount: Number(s.last_unit_cost).toLocaleString('fr-FR'), unit: s.last_unit.short_name })}
                  </span>
                )}
                <PriceTrend last={s.last_cost} previous={s.previous_cost} />
              </span>
            )
            const key = `${s.supplier?.id ?? 'none'}-${s.variant?.id ?? ''}`
            return (
              <li key={key}>
                {s.supplier && can('suppliers.view') ? (
                  <Link to={`/fournisseurs/${s.supplier.id}`} className="flex items-start gap-3 rounded-md px-1 py-3 hover:bg-muted">
                    {name}
                    {price}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-1 py-3">
                    {name}
                    {price}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </FormSection>
  )
}
