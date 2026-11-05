import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import type { ExpiryState } from '@/types/catalog'

const TONE = { expired: 'danger', soon: 'warn', ok: 'paid', undated: 'neutral' } as const

/** État d'un arrivage (§7.11) : la couleur et le libellé disent la même chose (§3.5). */
export function ExpiryBadge({ state }: { state: ExpiryState }) {
  const { t } = useTranslation()
  return <StatusBadge tone={TONE[state]}>{t(`stock.expiry.state.${state}`)}</StatusBadge>
}
