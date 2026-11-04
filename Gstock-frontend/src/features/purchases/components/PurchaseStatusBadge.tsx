import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import type { PurchasePaymentStatus, PurchaseStatus } from '@/types/purchases'

const TONE = { paid: 'paid', partial: 'warn', unpaid: 'danger' } as const

/** Paiement d'un approvisionnement ; un approvisionnement annulé l'emporte. */
export function PurchaseStatusBadge({ status, purchaseStatus = 'received' }: { status: PurchasePaymentStatus; purchaseStatus?: PurchaseStatus }) {
  const { t } = useTranslation()
  if (purchaseStatus === 'cancelled') return <StatusBadge>{t('purchases.cancelled')}</StatusBadge>
  return <StatusBadge tone={TONE[status]}>{t(`purchases.payment_status.${status}`)}</StatusBadge>
}
