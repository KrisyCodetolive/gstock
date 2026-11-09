import { Ban, Info, Plus, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CancelDialog } from '@/components/CancelDialog'
import { DataList } from '@/components/DataList'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { Pagination, SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCan, useSession } from '@/features/auth/hooks'
import { QuickReferentialCreate } from '@/features/referentials/components/QuickReferentialCreate'
import { useReferentialList } from '@/features/referentials/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { ApiError } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDateTime, formatShortDate } from '@/lib/format'
import { useListParams } from '@/lib/use-list-params'
import { cn } from '@/lib/utils'
import type { Expense } from '@/types/purchases'
import { useCancelExpense, useCreateExpense, useExpenses } from '../hooks'

type Period = 'today' | 'week' | 'month' | 'all'
const PERIODS: Period[] = ['today', 'week', 'month', 'all']
const ALL = 'all'

function periodFrom(period: Period): string | undefined {
  if (period === 'all') return undefined
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() - (period === 'today' ? 0 : period === 'week' ? 6 : 29) * 86_400_000).toISOString()
}

/** Dépenses DP-N (M12) : l'argent sorti de la boutique. */
export function ExpensesPage() {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const list = useListParams(['periode', 'categorie', 'ajouter'])
  const period: Period = (PERIODS as string[]).includes(list.filter.periode ?? '') ? (list.filter.periode as Period) : 'month'
  const expenses = useExpenses(shop?.id, { page: list.page, search: list.params.search, filter: { from: periodFrom(period), expense_category_id: list.filter.categorie } })
  const categories = useReferentialList('expense-categories', { per_page: 100, sort: 'name' })
  // Action rapide de l'accueil : /depenses?ajouter=1 ouvre directement la saisie.
  const [creating, setCreating] = useState(list.filter.ajouter === '1')
  const [selected, setSelected] = useState<Expense | null>(null)

  const amount = (e: Expense) => <Money value={e.amount} className={e.status === 'cancelled' ? 'line-through opacity-60' : undefined} />

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle', { shop: shop?.name ?? '' })}
        actions={
          can('expenses.create') && (
            <Button variant="action" onClick={() => setCreating(true)}>
              <Plus strokeWidth={2.6} aria-hidden="true" />
              {t('expenses.add')}
            </Button>
          )
        }
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('credits.period')}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => list.setFilter('periode', p === 'month' ? undefined : p)}
            className={cn('min-h-10 shrink-0 rounded-sm border-2 border-foreground px-3 text-sm font-bold whitespace-nowrap', period === p ? 'bg-foreground text-background' : 'bg-card')}
          >
            {t(`credits.periods.${p}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('expenses.search')} />
        <div className="sm:w-60">
          <Select value={list.filter.categorie ?? ALL} onValueChange={(v) => list.setFilter('categorie', v === ALL ? undefined : v)}>
            <SelectTrigger aria-label={t('expenses.filter_category')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('expenses.all_categories')}</SelectItem>
              {categories.data?.data.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!can('records.view_all') && (
        <p className="flex gap-2 rounded-sm bg-muted p-3 text-sm">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t('expenses.own_only')}
        </p>
      )}

      {expenses.data && (
        <div className="grid gap-3 rounded-lg border-2 border-foreground bg-card p-4 sm:grid-cols-[auto_1fr] sm:gap-6">
          <div className="grid content-start gap-1">
            <span className="text-sm font-semibold text-muted-foreground">{t('expenses.total')}</span>
            <Money value={expenses.data.summary.total} size="lg" className="text-destructive" />
            <span className="text-xs text-muted-foreground">{t('expenses.count', { count: expenses.data.summary.count })}</span>
          </div>
          {expenses.data.summary.by_category.length > 0 && (
            <div className="grid gap-1">
              <span className="text-sm font-semibold text-muted-foreground">{t('expenses.by_category')}</span>
              <ul className="grid gap-0.5 text-sm">
                {expenses.data.summary.by_category.map((c) => (
                  <li key={c.category.id}>
                    <button type="button" className="flex w-full justify-between gap-2 rounded-sm px-1 text-left hover:bg-muted" onClick={() => list.setFilter('categorie', String(c.category.id))}>
                      <span>{c.category.name}</span>
                      <Money value={c.total} className="text-sm" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {expenses.isPending ? (
        <LoadingState rows={4} />
      ) : expenses.isError ? (
        <ErrorState error={expenses.error} onRetry={() => void expenses.refetch()} />
      ) : expenses.data.data.length === 0 ? (
        <EmptyState icon={Wallet} title={t('expenses.empty_title')} text={t('expenses.empty_text')} />
      ) : (
        <>
          <DataList
            label={t('expenses.title')}
            items={expenses.data.data}
            getKey={(e) => e.id}
            onSelect={setSelected}
            columns={[
              { header: t('expenses.columns.reference'), cell: (e) => e.reference },
              { header: t('expenses.columns.date'), cell: (e) => formatShortDate(e.occurred_at), className: 'text-muted-foreground' },
              { header: t('expenses.columns.category'), cell: (e) => e.category.name },
              { header: t('expenses.columns.note'), cell: (e) => e.note ?? '—', className: 'text-muted-foreground' },
              { header: t('expenses.columns.method'), cell: (e) => e.method.name, className: 'text-muted-foreground' },
              { header: t('expenses.columns.amount'), cell: amount },
            ]}
            card={(e) => (
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-bold">
                    {e.category.name}
                    {e.status === 'cancelled' && <StatusBadge>{t('expenses.cancelled')}</StatusBadge>}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{[formatShortDate(e.occurred_at), e.note, e.reference].filter(Boolean).join(' · ')}</span>
                </div>
                {amount(e)}
              </div>
            )}
          />
          <Pagination page={expenses.data.meta.current_page} lastPage={expenses.data.meta.last_page} total={expenses.data.meta.total} onPage={list.setPage} />
        </>
      )}

      {creating && (
        <ExpenseForm
          onClose={() => {
            setCreating(false)
            list.setFilter('ajouter', undefined)
          }}
        />
      )}
      {selected && <ExpenseDetail expense={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const create = useCreateExpense(shop?.id)
  const me = useSession()
  const categories = useReferentialList('expense-categories', { per_page: 100, sort: 'name', filter: { is_active: 'true' } })
  const methods = useReferentialList('payment-methods', { per_page: 100, filter: { is_active: 'true' } })
  // Idempotence : réessayer après une coupure n'enregistre pas deux dépenses (ADR-005).
  const [offlineUuid] = useState(() => crypto.randomUUID())
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = amount.replace(/\s/g, '').replace(',', '.')
    const next = {
      category: category ? undefined : t('expenses.form.required_category'),
      amount: Number(value) > 0 ? undefined : t('expenses.form.required_amount'),
      method: method ? undefined : t('expenses.form.required_method'),
    }
    setErrors(next)
    if (next.category || next.amount || next.method) return
    create.mutate(
      {
        context: { shopName: shop?.name ?? '', userId: me.user.id, label: categories.data?.data.find((c) => String(c.id) === category)?.name ?? null },
        payload: {
        expense_category_id: Number(category),
        amount: value,
        payment_method_id: Number(method),
        occurred_at: date ? new Date(`${date}T12:00:00Z`).toISOString() : undefined,
        note: note || null,
        offline_uuid: offlineUuid,
        },
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.kind === 'offline'
              ? t('offline.saved_offline', { reference: result.operation.provisional_reference })
              : t('expenses.form.done', { reference: result.data.reference }),
          )
          onClose()
        },
        onError: (err) => setErrors(err instanceof ApiError && Object.keys(err.errors).length === 0 ? { form: err.message } : { form: apiErrorMessage(err) }),
      },
    )
  }

  const select = (id: string, value: string, onChange: (v: string) => void, options: { id: number; name: string }[] | undefined, placeholder: string, error?: string) => (
    <div className="grid gap-2">
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options?.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={t('expenses.form.title')}>
      <form onSubmit={submit} noValidate className="grid min-h-full content-between gap-6">
        <div className="grid gap-5">
          {errors.form && <FormAlert>{errors.form}</FormAlert>}
          <div className="grid gap-2">
            <label htmlFor="expense-category" className="text-sm font-semibold">
              {t('expenses.form.category')}
            </label>
            {select('expense-category', category, setCategory, categories.data?.data, t('expenses.form.category_placeholder'), errors.category)}
            <QuickReferentialCreate resource="expense-categories" onCreated={(id) => setCategory(String(id))} />
          </div>
          <FormField id="expense-amount" label={t('expenses.form.amount')} error={errors.amount}>
            <Input inputMode="numeric" className="tabular text-lg font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <div className="grid gap-2">
            <label htmlFor="expense-method" className="text-sm font-semibold">
              {t('expenses.form.method')}
            </label>
            {select('expense-method', method, setMethod, methods.data?.data, t('sales.pos.method'), errors.method)}
          </div>
          <FormField id="expense-date" label={t('expenses.form.date')} optional>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField id="expense-note" label={t('expenses.form.note')} optional>
            <Textarea rows={2} placeholder={t('expenses.form.note_placeholder')} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
        <div className="sticky -bottom-4 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-muted bg-popover px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={create.isPending}>
            {create.isPending ? t('common.saving') : t('expenses.form.submit')}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  )
}

function ExpenseDetail({ expense: e, onClose }: { expense: Expense; onClose: () => void }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const cancel = useCancelExpense(shop?.id, e.id)
  const [cancelOpen, setCancelOpen] = useState(false)

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={t('expenses.detail.title', { reference: e.reference })} description={t('expenses.detail.by', { name: e.user?.name ?? '—', date: formatDateTime(e.occurred_at) })}>
      <div className="grid gap-4">
        <Money value={e.amount} size="lg" className={e.status === 'cancelled' ? 'line-through opacity-60' : 'text-destructive'} />
        <dl className="grid gap-1">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t('expenses.columns.category')}</dt>
            <dd className="font-bold">{e.category.name}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t('expenses.columns.method')}</dt>
            <dd className="font-bold">{e.method.name}</dd>
          </div>
          {e.note && <p className="mt-2">{e.note}</p>}
        </dl>
        {e.status === 'cancelled' && e.cancelled_at && (
          <p className="rounded-sm border-2 border-destructive bg-destructive-bg p-3 font-semibold text-destructive">
            {t('expenses.detail.cancelled_on', { date: formatDateTime(e.cancelled_at), reason: e.cancel_reason })}
          </p>
        )}
        {e.status !== 'cancelled' && can('expenses.cancel') && (
          <Button variant="destructive" className="justify-self-start" onClick={() => setCancelOpen(true)}>
            <Ban aria-hidden="true" />
            {t('expenses.detail.cancel')}
          </Button>
        )}
        <CancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title={t('expenses.detail.cancel_title', { reference: e.reference })}
          description={t('expenses.detail.cancel_text')}
          reasonLabel={t('expenses.detail.cancel_reason')}
          requiredMessage={t('expenses.detail.cancel_reason_required')}
          confirmLabel={t('expenses.detail.cancel')}
          pending={cancel.isPending}
          onConfirm={async (reason) => {
            try {
              await cancel.mutateAsync(reason)
              toast.success(t('expenses.detail.cancelled_done'))
              onClose()
              return null
            } catch (err) {
              return apiErrorMessage(err)
            }
          }}
        />
      </div>
    </ResponsiveSheet>
  )
}
