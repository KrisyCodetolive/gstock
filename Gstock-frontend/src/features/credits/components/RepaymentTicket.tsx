import { useTranslation } from 'react-i18next'
import { formatAmount, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RepaymentReceipt } from '@/types/credits'

/** Reçu de remboursement (M09) : boutique, client, montant, mode, reste, RB-N. */
export function RepaymentTicket({ receipt, width = 58 }: { receipt: RepaymentReceipt; width?: 58 | 80 }) {
  const { t } = useTranslation()
  const { repayment: r, shop, tenant } = receipt
  return (
    <article
      className={cn('receipt mx-auto grid gap-3 bg-white px-4 py-5 font-mono text-[12px] leading-snug text-black', width === 58 ? 'w-[58mm]' : 'w-[80mm] text-[13px]')}
      aria-label={t('credits.repayment_detail.title', { reference: r.reference })}
    >
      <header className="grid justify-items-center gap-0.5 text-center">
        <strong className="text-[14px] uppercase">{tenant.name}</strong>
        <span>{shop.name}</span>
        {shop.address && <span>{shop.address}</span>}
        {shop.show_phone && shop.phone && <span>Tél. {shop.phone}</span>}
      </header>
      <hr className="border-dashed border-black" />
      <strong className="text-center">{t('credits.receipt.title')}</strong>
      <div className="grid">
        <span>
          {r.reference} · {formatDateTime(r.received_at)}
        </span>
        <span>{t('sales.receipt.customer', { name: r.customer.name })}</span>
        {r.user && <span>{t('sales.receipt.seller', { name: r.user.name })}</span>}
      </div>
      {r.status === 'cancelled' && <strong className="border-2 border-black py-1 text-center">{t('credits.repayment_detail.cancelled').toUpperCase()}</strong>}
      <hr className="border-dashed border-black" />
      <dl className="grid gap-0.5">
        <div className="flex justify-between text-[15px] font-bold">
          <dt>{t('credits.receipt.received')}</dt>
          <dd>{formatAmount(r.amount)} FCFA</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t('credits.receipt.method')}</dt>
          <dd>{r.method?.name ?? t('sales.detail.credit_note')}</dd>
        </div>
        {r.allocations.map((a) => (
          <div key={a.credit.id} className="flex justify-between">
            <dt>
              {t('credits.receipt.allocated_to')} {a.credit.reference}
            </dt>
            <dd>{formatAmount(a.amount)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between font-bold">
          <dt>{t('credits.receipt.remaining')}</dt>
          <dd>{formatAmount(r.balance_after)} FCFA</dd>
        </div>
      </dl>
      <hr className="border-dashed border-black" />
      <footer className="grid gap-1 text-center">
        <span>{t('credits.receipt.thanks')}</span>
        {tenant.footer && <span>{tenant.footer}</span>}
      </footer>
    </article>
  )
}
