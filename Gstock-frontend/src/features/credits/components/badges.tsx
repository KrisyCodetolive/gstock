import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import type { CreditStatus } from '@/types/customers'
import type { InstallmentStatus } from '@/types/credits'

const CREDIT_TONE = { open: 'danger', partial: 'warn', settled: 'paid', cancelled: 'neutral' } as const
const INSTALLMENT_TONE = { pending: 'neutral', partial: 'warn', paid: 'paid', overdue: 'danger' } as const

export function CreditStatusBadge({ status }: { status: CreditStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={CREDIT_TONE[status]}>{t(`credits.status.${status}`)}</StatusBadge>
}

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  const { t } = useTranslation()
  return <StatusBadge tone={INSTALLMENT_TONE[status]}>{t(`credits.installment_status.${status}`)}</StatusBadge>
}
