import { Ban, CalendarClock, ChevronDown, Scale } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Money } from '@/components/Money'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatDateTime, formatQuantity, formatShortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CreditDetail } from '@/types/credits'
import { CreditStatusBadge, InstallmentStatusBadge } from './badges'
import { AdjustCreditSheet, CancelCreditDialog, ScheduleSheet } from './CreditSheets'

/**
 * Un crédit sur la fiche crédit du client : origine (vente et articles ou ancienne
 * dette), paiements affectés, régularisations, échéancier et actions autorisées.
 */
export function CreditItem({ credit: c }: { credit: CreditDetail }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const [open, setOpen] = useState(c.status !== 'settled' && c.status !== 'cancelled')
  const [sheet, setSheet] = useState<'adjust' | 'schedule' | 'cancel' | null>(null)
  const here = c.shop.id === shop?.id
  const live = c.status !== 'cancelled' && c.status !== 'settled'

  return (
    <li className="rounded-lg border-2 border-foreground bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="grid min-w-0 flex-1">
          <span className="font-bold">
            {c.is_opening_balance ? t('credits.opening_balance') : t('credits.from_sale', { reference: c.sale?.reference })} · {c.reference}
          </span>
          <span className="text-sm text-muted-foreground">
            {formatShortDate(c.occurred_at)} · {c.shop.name} · {t('credits.credit.amount', { amount: Number(c.amount).toLocaleString('fr-FR') })}
          </span>
        </span>
        <span className="grid shrink-0 justify-items-end gap-1">
          {live && <Money value={c.remaining_amount} className="text-destructive" />}
          <CreditStatusBadge status={c.status} />
        </span>
        <ChevronDown className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="grid gap-4 border-t-2 border-muted p-3 text-[15px]">
          {c.status === 'cancelled' && c.cancelled_at && (
            <div className="grid gap-1 rounded-sm bg-muted p-2 text-sm">
              <span className="font-semibold">{t('credits.credit.cancelled_on', { date: formatDateTime(c.cancelled_at), reason: c.cancel_reason })}</span>
              {c.cancel_settlement && (
                <span>
                  {c.cancel_settlement.mode === 'credit_note'
                    ? t('credits.credit.settled_credit_note', { amount: Number(c.cancel_settlement.amount).toLocaleString('fr-FR') })
                    : t('credits.credit.settled_refund', { amount: Number(c.cancel_settlement.amount).toLocaleString('fr-FR') })}
                </span>
              )}
            </div>
          )}

          <p className="flex flex-wrap gap-x-4 text-sm">
            <span>{t('credits.credit.repaid', { amount: Number(c.repaid_amount).toLocaleString('fr-FR') })}</span>
            {Number(c.adjusted_amount) !== 0 && <span>{t('credits.credit.adjusted', { amount: Number(c.adjusted_amount).toLocaleString('fr-FR') })}</span>}
          </p>

          {c.sale && (
            <section className="grid gap-1">
              <h4 className="text-sm font-bold">{t('credits.credit.items')}</h4>
              <ul className="grid gap-0.5 text-sm">
                {c.sale.items.map((i) => (
                  <li key={i.name} className="flex justify-between gap-2">
                    <span>
                      {formatQuantity(i.quantity)} × {i.name}
                    </span>
                    <Money value={i.subtotal} className="text-sm" />
                  </li>
                ))}
              </ul>
              {here && can('sales.view') && (
                <Link to={`/ventes/${c.sale.id}`} className="justify-self-start text-sm font-bold text-primary hover:underline">
                  {t('credits.credit.see_sale')}
                </Link>
              )}
            </section>
          )}

          {c.allocations.length > 0 && (
            <section className="grid gap-1">
              <h4 className="text-sm font-bold">{t('credits.credit.allocations')}</h4>
              <ul className="grid gap-0.5 text-sm">
                {c.allocations.map((a) => (
                  <li key={a.repayment.id} className="flex justify-between gap-2">
                    {here ? (
                      <Link to={`/credits/paiements/${a.repayment.id}`} className="font-semibold text-primary hover:underline">
                        {a.repayment.reference} · {formatShortDate(a.repayment.received_at)}
                      </Link>
                    ) : (
                      <span>
                        {a.repayment.reference} · {formatShortDate(a.repayment.received_at)}
                      </span>
                    )}
                    <Money value={a.amount} className="text-sm text-paid-ink" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.adjustments.length > 0 && (
            <section className="grid gap-1">
              <h4 className="text-sm font-bold">{t('credits.credit.adjustments')}</h4>
              <ul className="grid gap-0.5 text-sm">
                {c.adjustments.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>
                      {formatShortDate(a.created_at)} · {a.reason}
                    </span>
                    <span className="tabular font-bold">
                      {Number(a.amount) > 0 ? '−' : '+'}
                      {Math.abs(Number(a.amount)).toLocaleString('fr-FR')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid gap-1">
            <h4 className="text-sm font-bold">{t('credits.credit.installments')}</h4>
            {c.installments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('credits.credit.no_installments')}</p>
            ) : (
              <ul className="grid gap-1 text-sm">
                {c.installments.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{formatShortDate(i.due_date)}</span>
                    <span className="flex items-center gap-2">
                      <Money value={i.amount} className="text-sm" />
                      <InstallmentStatusBadge status={i.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {live && !here && <p className="text-sm text-muted-foreground">{t('credits.file.other_shop', { shop: c.shop.name })}</p>}
          {live && here && (
            <div className="flex flex-wrap gap-2">
              {can('credits.create') && (
                <Button variant="outline" size="sm" onClick={() => setSheet('schedule')}>
                  <CalendarClock aria-hidden="true" />
                  {t('credits.credit.schedule')}
                </Button>
              )}
              {can('credits.cancel') && (
                <Button variant="outline" size="sm" onClick={() => setSheet('adjust')}>
                  <Scale aria-hidden="true" />
                  {t('credits.credit.adjust')}
                </Button>
              )}
              {can('credits.cancel') && c.is_opening_balance && (
                <Button variant="destructive" size="sm" onClick={() => setSheet('cancel')}>
                  <Ban aria-hidden="true" />
                  {t('credits.credit.cancel')}
                </Button>
              )}
            </div>
          )}
          {live && here && c.sale && can('credits.cancel') && <p className="text-xs text-muted-foreground">{t('credits.credit.sale_cancel_hint')}</p>}
        </div>
      )}

      {sheet === 'adjust' && <AdjustCreditSheet credit={c} open onOpenChange={(o) => !o && setSheet(null)} />}
      {sheet === 'schedule' && <ScheduleSheet credit={c} open onOpenChange={(o) => !o && setSheet(null)} />}
      {sheet === 'cancel' && <CancelCreditDialog credit={c} open onOpenChange={(o) => !o && setSheet(null)} />}
    </li>
  )
}
