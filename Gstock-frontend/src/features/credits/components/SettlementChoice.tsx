import { HandCoins, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useReferentialList } from '@/features/referentials/hooks'
import { cn } from '@/lib/utils'
import type { CancelSettlement, RefundMode } from '@/types/credits'

/**
 * Décision P3 : à l'annulation d'un crédit déjà en partie payé, l'argent reçu
 * n'est jamais perdu. Le commerçant choisit : avoir au nom du client, ou argent rendu.
 */
export function SettlementChoice({
  amount,
  value,
  onChange,
}: {
  amount: string
  value: CancelSettlement
  onChange: (value: CancelSettlement) => void
}) {
  const { t } = useTranslation()
  const methods = useReferentialList('payment-methods', { per_page: 100, filter: { is_active: 'true' } })
  const options: { mode: RefundMode; icon: typeof Wallet; label: string; hint: string }[] = [
    { mode: 'credit_note', icon: Wallet, label: t('credits.settlement.credit_note'), hint: t('credits.settlement.credit_note_hint') },
    { mode: 'refund', icon: HandCoins, label: t('credits.settlement.refund'), hint: t('credits.settlement.refund_hint') },
  ]

  return (
    <fieldset className="grid gap-3 rounded-md border-2 border-foreground bg-warn-bg p-3">
      <legend className="sr-only">{t('credits.settlement.title', { amount: Number(amount).toLocaleString('fr-FR') })}</legend>
      <div className="grid gap-0.5" aria-hidden="true">
        <span className="font-bold">{t('credits.settlement.title', { amount: Number(amount).toLocaleString('fr-FR') })}</span>
        <span className="text-sm">{t('credits.settlement.text')}</span>
      </div>
      <div className="grid gap-2" role="radiogroup">
        {options.map((o) => {
          const active = value.refund_mode === o.mode
          return (
            <button
              key={o.mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ ...value, refund_mode: o.mode })}
              className={cn('pressable flex items-start gap-3 rounded-md p-3 text-left', active ? 'bg-primary text-primary-foreground' : 'bg-card')}
            >
              <o.icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span className="grid">
                <span className="font-bold">{o.label}</span>
                <span className={cn('text-sm', active ? 'opacity-90' : 'text-muted-foreground')}>{o.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      {value.refund_mode === 'refund' && (
        <div className="grid gap-2">
          <label htmlFor="refund-method" className="text-sm font-semibold">
            {t('credits.settlement.refund_method')}
          </label>
          <Select
            value={value.refund_payment_method_id ? String(value.refund_payment_method_id) : undefined}
            onValueChange={(v) => onChange({ ...value, refund_payment_method_id: Number(v) })}
          >
            <SelectTrigger id="refund-method">
              <SelectValue placeholder={t('sales.pos.method')} />
            </SelectTrigger>
            <SelectContent>
              {methods.data?.data.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </fieldset>
  )
}
