import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import type { PaymentStatus, SaleStatus } from '@/types/sales'

const TONE = { paid: 'paid', partial: 'warn', credit: 'danger' } as const

/** Statut de paiement d'une vente ; une vente annulée l'emporte (§7.5). */
export function PaymentStatusBadge({ status, saleStatus = 'completed' }: { status: PaymentStatus; saleStatus?: SaleStatus }) {
  const { t } = useTranslation()
  if (saleStatus === 'cancelled') return <StatusBadge>{t('sales.cancelled')}</StatusBadge>
  return <StatusBadge tone={TONE[status]}>{t(`sales.payment_status.${status}`)}</StatusBadge>
}
