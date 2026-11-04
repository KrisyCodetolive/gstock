import { useTranslation } from 'react-i18next'
import { formatAmount, formatDateTime, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Receipt } from '@/types/sales'

/**
 * Reçu façon ticket de caisse (58 ou 80 mm), à l'écran et à l'impression.
 * Chiffres en police à chasse fixe pour que les colonnes s'alignent.
 */
export function ReceiptTicket({ receipt, width = 58 }: { receipt: Receipt; width?: 58 | 80 }) {
  const { t } = useTranslation()
  const { sale, shop, tenant } = receipt
  const cancelled = sale.status === 'cancelled'
  const change = sale.payments.reduce((s, p) => s + Number(p.change ?? 0), 0)

  return (
    <article
      className={cn(
        'receipt mx-auto grid gap-3 bg-white px-4 py-5 font-mono text-[12px] leading-snug text-black',
        width === 58 ? 'w-[58mm]' : 'w-[80mm] text-[13px]',
      )}
      style={{ ['--receipt-width' as string]: `${width}mm` }}
      aria-label={t('sales.receipt.title', { reference: sale.reference })}
    >
      <header className="grid justify-items-center gap-0.5 text-center">
        <strong className="text-[14px] uppercase">{tenant.name}</strong>
        <span>{shop.name}</span>
        {shop.address && <span>{shop.address}</span>}
        {shop.show_phone && shop.phone && <span>Tél. {shop.phone}</span>}
      </header>
      <hr className="border-dashed border-black" />
      <div className="grid">
        <span>
          {sale.reference} · {formatDateTime(sale.occurred_at)}
        </span>
        {sale.user && <span>{t('sales.receipt.seller', { name: sale.user.name })}</span>}
        {shop.show_customer && sale.customer && <span>{t('sales.receipt.customer', { name: sale.customer.name })}</span>}
      </div>
      {cancelled && <strong className="border-2 border-black py-1 text-center">{t('sales.receipt.cancelled')}</strong>}
      <hr className="border-dashed border-black" />
      <ul className="grid gap-1.5">
        {sale.items.map((i) => (
          <li key={i.product.id} className="grid">
            <span>{i.product.name}</span>
            <span className="flex justify-between gap-2">
              <span>
                {formatQuantity(i.quantity)} x {formatAmount(i.price)}
                {Number(i.discount_amount) > 0 && ` -${formatAmount(i.discount_amount)}`}
              </span>
              <span>{formatAmount(i.subtotal)}</span>
            </span>
          </li>
        ))}
      </ul>
      <hr className="border-dashed border-black" />
      <dl className="grid gap-0.5">
        {Number(sale.discount) > 0 && (
          <div className="flex justify-between">
            <dt>{t('sales.detail.discount')}</dt>
            <dd>-{formatAmount(sale.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-[15px] font-bold">
          <dt>{t('sales.receipt.total')}</dt>
          <dd>{formatAmount(sale.total)} FCFA</dd>
        </div>
        {sale.payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <dt>{p.method.name}</dt>
            <dd>{formatAmount(p.cash_given ?? p.amount)}</dd>
          </div>
        ))}
        {change > 0 && (
          <div className="flex justify-between">
            <dt>{t('sales.receipt.change')}</dt>
            <dd>{formatAmount(change)}</dd>
          </div>
        )}
        {Number(sale.credit_amount) > 0 && (
          <div className="flex justify-between font-bold">
            <dt>{t('sales.receipt.due')}</dt>
            <dd>{formatAmount(sale.credit_amount)} FCFA</dd>
          </div>
        )}
      </dl>
      {(shop.note || tenant.footer) && (
        <>
          <hr className="border-dashed border-black" />
          <footer className="grid gap-1 text-center">
            {tenant.footer && <span>{tenant.footer}</span>}
            {shop.note && <span>{shop.note}</span>}
          </footer>
        </>
      )}
    </article>
  )
}
