import { TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Money } from '@/types/api'

/** Évolution du prix d'achat par rapport à l'achat précédent : une hausse coûte, une baisse profite (icône et texte, jamais la couleur seule). */
export function PriceTrend({ last, previous }: { last: Money; previous: Money | null }) {
  const { t } = useTranslation()
  if (previous === null || Number(previous) === 0 || Number(last) === Number(previous)) return null
  const pct = Math.round(((Number(last) - Number(previous)) / Number(previous)) * 1000) / 10
  const up = pct > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={up ? 'inline-flex items-center gap-1 text-sm font-semibold text-destructive' : 'inline-flex items-center gap-1 text-sm font-semibold text-paid-ink'}>
      <Icon className="size-4" aria-hidden="true" />
      {t(up ? 'suppliers.catalog.price_up' : 'suppliers.catalog.price_down', { value: Math.abs(pct).toLocaleString('fr-FR') })}
    </span>
  )
}
