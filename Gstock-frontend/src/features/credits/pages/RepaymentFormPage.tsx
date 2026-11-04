import { Smartphone, Wand2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useReferentialList } from '@/features/referentials/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatShortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CreditDetail, CustomerCreditFile } from '@/types/credits'
import { useCreateRepayment, useCustomerCredits } from '../hooks'

const NOTE = 'credit_note'
const clean = (v: string) => v.replace(/\s/g, '').replace(',', '.')

/** Proposition de répartition, du plus ancien au plus récent (§7.6). Le serveur vérifie. */
function proposeAllocation(amount: number, credits: CreditDetail[]): Record<number, string> {
  let left = amount
  const out: Record<number, string> = {}
  for (const c of credits) {
    const part = Math.max(0, Math.min(left, Number(c.remaining_amount)))
    out[c.id] = part > 0 ? String(part) : ''
    left -= part
  }
  return out
}

/** Recevoir un paiement d'un client (M09) dans la boutique courante. */
export function RepaymentFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const file = useCustomerCredits(Number(id))

  return (
    <div className="grid gap-6">
      <BackLink to={`/credits/clients/${id}`} label={file.data?.customer.name ?? t('credits.back')} />
      <PageHeader title={t('credits.repayment.title')} />
      {file.isPending ? (
        <LoadingState rows={4} />
      ) : file.isError ? (
        <ErrorState error={file.error} onRetry={() => void file.refetch()} />
      ) : (
        <RepaymentForm file={file.data} />
      )}
    </div>
  )
}

function RepaymentForm({ file }: { file: CustomerCreditFile }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { shop } = useCurrentShop()
  const create = useCreateRepayment(shop?.id)
  const methods = useReferentialList('payment-methods', { per_page: 100, filter: { is_active: 'true' } })
  const [offlineUuid] = useState(() => crypto.randomUUID())
  const credits = file.credits
    .filter((c) => c.shop.id === shop?.id && c.status !== 'cancelled' && Number(c.remaining_amount) > 0)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id - b.id)
  const due = credits.reduce((s, c) => s + Number(c.remaining_amount), 0)
  const note = Number(file.credit_note_balance)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>('')
  const [receivedAt, setReceivedAt] = useState('')
  const [comment, setComment] = useState('')
  const [split, setSplit] = useState<Record<number, string>>({})
  const [manual, setManual] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const value = Number(clean(amount)) || 0
  const changeAmount = (v: string) => {
    setAmount(v)
    if (!manual) setSplit(proposeAllocation(Number(clean(v)) || 0, credits))
  }
  const allocated = credits.reduce((s, c) => s + (Number(clean(split[c.id] ?? '')) || 0), 0)
  const selectedMethod = methods.data?.data.find((m) => String(m.id) === method)

  const errors = {
    amount: !(value > 0) ? t('credits.repayment.required_amount') : value > due ? t('credits.repayment.too_much', { amount: due.toLocaleString('fr-FR') }) : null,
    method: method === '' ? t('credits.repayment.required_method') : null,
    split: value > 0 && Math.round(allocated * 100) !== Math.round(value * 100) ? t('credits.repayment.split_mismatch') : null,
  }

  if (!shop || credits.length === 0) return <EmptyState title={t('credits.repayment.nothing_due')} />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (errors.amount || errors.method || errors.split) return
    create.mutate(
      {
        customer_id: file.customer.id,
        amount: String(value),
        payment_method_id: method === NOTE ? null : Number(method),
        use_credit_note: method === NOTE,
        received_at: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        note: comment || null,
        allocations: credits.filter((c) => Number(clean(split[c.id] ?? '')) > 0).map((c) => ({ credit_id: c.id, amount: clean(split[c.id]!) })),
        offline_uuid: offlineUuid,
      },
      {
        onSuccess: (r) => {
          toast.success(t('credits.repayment.done', { reference: r.reference }))
          navigate(`/credits/paiements/${r.id}`, { replace: true })
        },
        onError: (err) => setServerError(apiErrorMessage(err)),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {serverError && <FormAlert>{serverError}</FormAlert>}

      <FormSection title={file.customer.name} description={t('credits.repayment.due', { amount: due.toLocaleString('fr-FR'), shop: shop.name })}>
        <div className="grid gap-2">
          <FormField id="repay-amount" label={t('credits.repayment.amount')} error={submitted ? (errors.amount ?? undefined) : undefined}>
            <Input inputMode="numeric" className="tabular text-xl font-bold" value={amount} onChange={(e) => changeAmount(e.target.value)} autoFocus />
          </FormField>
          <Button type="button" variant="outline" size="sm" className="justify-self-start tabular" onClick={() => changeAmount(String(due))}>
            {t('credits.repayment.pay_all', { amount: due.toLocaleString('fr-FR') })}
          </Button>
        </div>
        <div className="grid gap-2">
          <label htmlFor="repay-method" className="text-sm font-semibold">
            {t('credits.repayment.method')}
          </label>
          <Select value={method || undefined} onValueChange={setMethod}>
            <SelectTrigger id="repay-method" aria-invalid={submitted && errors.method ? true : undefined}>
              <SelectValue placeholder={t('sales.pos.method')} />
            </SelectTrigger>
            <SelectContent>
              {methods.data?.data.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
              {note > 0 && <SelectItem value={NOTE}>{t('credits.repayment.use_credit_note', { amount: note.toLocaleString('fr-FR') })}</SelectItem>}
            </SelectContent>
          </Select>
          {submitted && errors.method && <FieldError>{errors.method}</FieldError>}
          {selectedMethod?.uses_geniuspay && (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <Smartphone className="size-5 shrink-0 text-primary" aria-hidden="true" />
              {t('credits.repayment.geniuspay_hint')}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="repay-date" label={t('credits.repayment.received_at')} optional>
            <Input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          </FormField>
          <FormField id="repay-note" label={t('credits.repayment.note')} optional>
            <Textarea rows={1} value={comment} onChange={(e) => setComment(e.target.value)} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title={t('credits.repayment.allocation')} description={t('credits.repayment.allocation_hint')}>
        <ul className="grid gap-2">
          {credits.map((c) => (
            <li key={c.id} className="grid grid-cols-[1fr_8rem] items-center gap-3">
              <label htmlFor={`alloc-${c.id}`} className="grid">
                <span className="font-bold">
                  {c.is_opening_balance ? t('credits.opening_balance') : t('credits.from_sale', { reference: c.sale?.reference })}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatShortDate(c.occurred_at)} · {t('credits.repayment.remaining_on', { amount: Number(c.remaining_amount).toLocaleString('fr-FR') })}
                </span>
              </label>
              <Input
                id={`alloc-${c.id}`}
                inputMode="numeric"
                className="tabular text-right"
                value={split[c.id] ?? ''}
                onChange={(e) => {
                  setManual(true)
                  setSplit((s) => ({ ...s, [c.id]: e.target.value }))
                }}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn('font-bold', errors.split ? 'text-destructive' : 'text-paid-ink')} aria-live="polite">
            {t('credits.repayment.allocated', { allocated: allocated.toLocaleString('fr-FR'), amount: value.toLocaleString('fr-FR') })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setManual(false)
              setSplit(proposeAllocation(value, credits))
            }}
          >
            <Wand2 aria-hidden="true" />
            {t('credits.repayment.auto')}
          </Button>
        </div>
        {submitted && errors.split && <FieldError>{errors.split}</FieldError>}
        {value > 0 && <Money value={String(value)} size="lg" className="justify-self-end" />}
      </FormSection>

      <FormActions>
        <Button type="button" variant="outline" disabled={create.isPending} onClick={() => navigate(-1)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="action" size="lg" disabled={create.isPending}>
          {create.isPending ? t('common.saving') : t('credits.repayment.submit')}
        </Button>
      </FormActions>
    </form>
  )
}
