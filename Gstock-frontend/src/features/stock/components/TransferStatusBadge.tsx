import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import type { TransferStatus } from '@/types/stock'

/** Statut d'un transfert vu depuis la boutique : « À réceptionner » pour celle qui le reçoit. */
export function TransferStatusBadge({ status, direction }: { status: TransferStatus; direction: 'out' | 'in' }) {
  const { t } = useTranslation()
  if (status === 'in_transit') {
    return <StatusBadge tone="warn">{direction === 'in' ? t('stock.transfers.status.to_receive') : t('stock.transfers.status.in_transit')}</StatusBadge>
  }
  return <StatusBadge tone={status === 'received' ? 'paid' : 'neutral'}>{t(`stock.transfers.status.${status}`)}</StatusBadge>
}
