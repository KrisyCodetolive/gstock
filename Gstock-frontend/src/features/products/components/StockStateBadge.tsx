import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import type { StockState } from '@/types/catalog'

const TONE = { ok: 'paid', low: 'warn', out: 'danger' } as const

/** État du stock : la couleur et le libellé disent la même chose (§3.5). */
export function StockStateBadge({ state }: { state: StockState }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONE[state]}>{t(`products.state.${state}`)}</StatusBadge>
}
