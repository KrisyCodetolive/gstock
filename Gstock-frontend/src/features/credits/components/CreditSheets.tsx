import { UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CancelDialog } from '@/components/CancelDialog'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CustomerPicker } from '@/features/pos/components/CustomerPicker'
import type { CartCustomer } from '@/features/pos/store'
import { useCurrentShop } from '@/features/shops/hooks'
import { ApiError } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import type { CancelSettlement, CreditDetail } from '@/types/credits'
import { useAdjustCredit, useCancelCredit, useOpeningBalance, useSetInstallments } from '../hooks'
import { SettlementChoice } from './SettlementChoice'
import { InstallmentScheduleSheet } from '@/components/InstallmentScheduleSheet'

const clean = (v: string) => v.replace(/\s/g, '').replace(',', '.')

function SheetActions({ pending, submitLabel, onCancel }: { pending: boolean; submitLabel: string; onCancel: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="sticky -bottom-4 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-muted bg-popover px-4 py-3">
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        {t('common.cancel')}
      </Button>
      <Button type="submit" variant="action" size="lg" disabled={pending}>
        {pending ? t('common.saving') : submitLabel}
      </Button>
    </div>
  )
}

/** Ancienne dette (solde initial CR-N), saisie sans vente (§7.6). */
export function OpeningBalanceSheet({ open, onOpenChange, customer: initial }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: CartCustomer }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const create = useOpeningBalance(shop?.id)
  const [customer, setCustomer] = useState<CartCustomer | undefined>(initial)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [picker, setPicker] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      customer_id: customer ? undefined : t('credits.opening_form.required_customer'),
      amount: Number(clean(amount)) > 0 ? undefined : t('credits.opening_form.required_amount'),
    }
    setErrors(next)
    if (next.customer_id || next.amount) return
    create.mutate(
      { customer_id: customer!.id, amount: clean(amount), occurred_at: date || undefined, note: note || null },
      {
        onSuccess: (credit) => {
          toast.success(t('credits.opening_form.done', { reference: credit.reference }))
          setAmount('')
          setNote('')
          onOpenChange(false)
        },
        onError: (err) =>
          setErrors(err instanceof ApiError ? { amount: err.fieldError('amount'), customer_id: err.fieldError('customer_id'), form: err.fieldError('amount') ? undefined : err.message } : { form: apiErrorMessage(err) }),
      },
    )
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('credits.opening_form.title')} description={t('credits.opening_form.hint')}>
      <form onSubmit={submit} noValidate className="grid min-h-full content-between gap-6">
        <div className="grid gap-5">
          {errors.form && <FormAlert>{errors.form}</FormAlert>}
          <div className="grid gap-2">
            <span className="text-sm font-semibold">{t('credits.opening_form.customer')}</span>
            <button type="button" onClick={() => setPicker(true)} className="pressable flex min-h-14 items-center gap-3 rounded-md bg-card px-3 text-left">
              <UserRound className="size-5" aria-hidden="true" />
              <span className="font-bold">{customer?.name ?? t('credits.opening_form.choose')}</span>
            </button>
            {errors.customer_id && <FieldError>{errors.customer_id}</FieldError>}
          </div>
          <FormField id="opening-amount" label={t('credits.opening_form.amount')} error={errors.amount}>
            <Input inputMode="numeric" className="tabular text-lg font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <FormField id="opening-date" label={t('credits.opening_form.date')} optional>
            <Input type="date" value={date} max={todayIso} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField id="opening-note" label={t('credits.opening_form.note')} optional>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
        <SheetActions pending={create.isPending} submitLabel={t('credits.opening_form.submit')} onCancel={() => onOpenChange(false)} />
      </form>
      <CustomerPicker open={picker} onOpenChange={setPicker} onPick={setCustomer} />
    </ResponsiveSheet>
  )
}

/** Régularisation d'un crédit : geste commercial ou correction, avec motif. */
export function AdjustCreditSheet({ credit, open, onOpenChange }: { credit: CreditDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const adjust = useAdjustCredit(shop?.id, credit.id)
  const [direction, setDirection] = useState<'decrease' | 'increase'>('decrease')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      amount: Number(clean(amount)) > 0 ? undefined : t('sales.pos.amount'),
      reason: reason.trim() ? undefined : t('credits.adjust_form.required_reason'),
    }
    setErrors(next)
    if (next.amount || next.reason) return
    const signed = direction === 'decrease' ? clean(amount) : `-${clean(amount)}`
    adjust.mutate(
      { amount: signed, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t('credits.adjust_form.done'))
          onOpenChange(false)
        },
        onError: (err) => setErrors(err instanceof ApiError ? { amount: err.fieldError('amount'), reason: err.fieldError('reason') } : { form: apiErrorMessage(err) }),
      },
    )
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('credits.adjust_form.title', { reference: credit.reference })} description={t('credits.adjust_form.hint')}>
      <form onSubmit={submit} noValidate className="grid min-h-full content-between gap-6">
        <div className="grid gap-5">
          {errors.form && <FormAlert>{errors.form}</FormAlert>}
          <div className="inline-flex justify-self-start rounded-md border-2 border-foreground bg-card p-1" role="group" aria-label={t('credits.adjust_form.direction')}>
            {(['decrease', 'increase'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={direction === d}
                onClick={() => setDirection(d)}
                className={cn('min-h-10 rounded-sm px-4 text-sm font-bold', direction === d ? 'bg-foreground text-background' : 'hover:bg-muted')}
              >
                {t(`credits.adjust_form.${d}`)}
              </button>
            ))}
          </div>
          <FormField id="adjust-amount" label={t('credits.adjust_form.amount')} error={errors.amount}>
            <Input inputMode="numeric" className="tabular text-lg font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <FormField id="adjust-reason" label={t('credits.adjust_form.reason')} error={errors.reason}>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
        <SheetActions pending={adjust.isPending} submitLabel={t('credits.adjust_form.submit')} onCancel={() => onOpenChange(false)} />
      </form>
    </ResponsiveSheet>
  )
}

/** Échéancier d'un crédit (§7.7). */
export function ScheduleSheet({ credit, open, onOpenChange }: { credit: CreditDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const save = useSetInstallments(shop?.id, credit.id)
  return (
    <InstallmentScheduleSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('credits.schedule_form.title', { reference: credit.reference })}
      remaining={Number(credit.remaining_amount)}
      installments={credit.installments}
      pending={save.isPending}
      onSave={(items) => save.mutateAsync(items)}
    />
  )
}

/** Annulation d'un crédit sans vente, avec le choix P3 si de l'argent a été reçu. */
export function CancelCreditDialog({ credit, open, onOpenChange }: { credit: CreditDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const cancel = useCancelCredit(shop?.id, credit.id)
  const [settlement, setSettlement] = useState<CancelSettlement>({})
  const repaid = Number(credit.repaid_amount)

  return (
    <CancelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('credits.cancel_form.title', { reference: credit.reference })}
      description={t('credits.cancel_form.text')}
      reasonLabel={t('credits.cancel_form.reason')}
      requiredMessage={t('credits.cancel_form.reason_required')}
      confirmLabel={t('credits.credit.cancel')}
      pending={cancel.isPending}
      onConfirm={async (reason) => {
        if (repaid > 0 && !settlement.refund_mode) return t('credits.settlement.required')
        try {
          await cancel.mutateAsync({ reason, ...settlement })
          toast.success(t('credits.cancel_form.done'))
          return null
        } catch (e) {
          return apiErrorMessage(e)
        }
      }}
    >
      {repaid > 0 && <SettlementChoice amount={credit.repaid_amount} value={settlement} onChange={setSettlement} />}
    </CancelDialog>
  )
}
