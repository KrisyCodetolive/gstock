import { Plus, Trash2, UserRound } from 'lucide-react'
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

interface Row {
  key: string
  due_date: string
  amount: string
}

const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

/** Échéancier (§7.7) : le total doit égaler le reste ; les échéances payées restent. */
export function ScheduleSheet({ credit, open, onOpenChange }: { credit: CreditDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const save = useSetInstallments(shop?.id, credit.id)
  const remaining = Number(credit.remaining_amount)
  const [count, setCount] = useState('2')
  const [every, setEvery] = useState(30)
  const [rows, setRows] = useState<Row[]>(() =>
    credit.installments
      .filter((i) => i.status !== 'paid')
      .map((i) => ({ key: String(i.id), due_date: i.due_date, amount: String(Number(i.amount) - Number(i.paid_amount)) })),
  )
  const [error, setError] = useState<string | null>(null)

  // Proposition de découpage en parts égales ; le serveur vérifie le total.
  const generate = () => {
    const n = Math.max(1, Math.min(24, Number(count) || 1))
    const part = Math.floor(remaining / n / 50) * 50
    setRows(
      Array.from({ length: n }, (_, i) => ({
        key: crypto.randomUUID(),
        due_date: addDays(every * (i + 1)),
        amount: String(i === n - 1 ? remaining - part * (n - 1) : part),
      })),
    )
  }

  const total = rows.reduce((s, r) => s + (Number(clean(r.amount)) || 0), 0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate(
      rows.map((r) => ({ due_date: r.due_date, amount: clean(r.amount) })),
      {
        onSuccess: () => {
          toast.success(t('credits.schedule_form.done'))
          onOpenChange(false)
        },
        onError: (err) => setError(apiErrorMessage(err)),
      },
    )
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('credits.schedule_form.title', { reference: credit.reference })}
      description={t('credits.schedule_form.hint', { amount: remaining.toLocaleString('fr-FR') })}
    >
      <form onSubmit={submit} noValidate className="grid min-h-full content-between gap-6">
        <div className="grid gap-5">
          {error && <FormAlert>{error}</FormAlert>}
          <div className="grid grid-cols-2 items-end gap-3">
            <FormField id="schedule-count" label={t('credits.schedule_form.count')}>
              <Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
            </FormField>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">{t('credits.schedule_form.every')}</span>
              <div className="inline-flex rounded-md border-2 border-foreground bg-card p-1" role="group" aria-label={t('credits.schedule_form.every')}>
                {[
                  { d: 7, l: t('credits.schedule_form.every_week') },
                  { d: 15, l: t('credits.schedule_form.every_two_weeks') },
                  { d: 30, l: t('credits.schedule_form.every_month') },
                ].map((o) => (
                  <button
                    key={o.d}
                    type="button"
                    aria-pressed={every === o.d}
                    onClick={() => setEvery(o.d)}
                    className={cn('min-h-10 flex-1 rounded-sm px-2 text-xs font-bold', every === o.d ? 'bg-foreground text-background' : 'hover:bg-muted')}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" className="justify-self-start" onClick={generate}>
            {t('credits.schedule_form.generate')}
          </Button>
          <ul className="grid gap-2">
            {rows.map((r, i) => (
              <li key={r.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="grid gap-1 text-sm font-semibold">
                  {i === 0 && t('credits.schedule_form.due_date')}
                  <Input type="date" value={r.due_date} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, due_date: e.target.value } : x)))} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  {i === 0 && t('credits.schedule_form.amount')}
                  <Input inputMode="numeric" className="tabular" value={r.amount} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))} />
                </label>
                <Button type="button" variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={t('credits.schedule_form.remove')}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" className="justify-self-start" onClick={() => setRows((rs) => [...rs, { key: crypto.randomUUID(), due_date: addDays(30), amount: '' }])}>
            <Plus aria-hidden="true" />
            {t('credits.schedule_form.add')}
          </Button>
          <p className={cn('font-bold', total === remaining ? 'text-paid-ink' : 'text-destructive')} aria-live="polite">
            {t('credits.schedule_form.total', { total: total.toLocaleString('fr-FR'), amount: remaining.toLocaleString('fr-FR') })}
          </p>
        </div>
        <SheetActions pending={save.isPending} submitLabel={t('credits.schedule_form.submit')} onCancel={() => onOpenChange(false)} />
      </form>
    </ResponsiveSheet>
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
