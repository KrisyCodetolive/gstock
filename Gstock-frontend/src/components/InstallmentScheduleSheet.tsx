import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert, FormField } from '@/components/FormField'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import type { Installment, InstallmentScheduleItem } from '@/types/credits'

const clean = (v: string) => v.replace(/\s/g, '').replace(',', '.')

interface Row {
  key: string
  due_date: string
  amount: string
}

const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

/**
 * Échéancier (§7.7) d'un crédit client ou d'une dette fournisseur : le total doit
 * égaler le reste ; les échéances déjà payées restent. Le serveur vérifie tout.
 */
export function InstallmentScheduleSheet({
  open,
  onOpenChange,
  title,
  remaining,
  installments,
  pending,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  remaining: number
  installments: Installment[]
  pending: boolean
  onSave: (items: InstallmentScheduleItem[]) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [count, setCount] = useState('2')
  const [every, setEvery] = useState(30)
  const [rows, setRows] = useState<Row[]>(() =>
    installments
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
    onSave(rows.map((r) => ({ due_date: r.due_date, amount: clean(r.amount) }))).then(
      () => {
        toast.success(t('credits.schedule_form.done'))
        onOpenChange(false)
      },
      (err: unknown) => setError(apiErrorMessage(err)),
    )
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
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
        <div className="sticky -bottom-4 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-muted bg-popover px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={pending}>
            {pending ? t('common.saving') : t('credits.schedule_form.submit')}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  )
}
