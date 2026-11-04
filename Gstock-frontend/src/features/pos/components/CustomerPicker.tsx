import { zodResolver } from '@hookform/resolvers/zod'
import { Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/FormField'
import { Money } from '@/components/Money'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan } from '@/features/auth/hooks'
import { CustomerFields } from '@/features/customers/components/CustomerFields'
import { useCustomers, useSaveCustomer } from '@/features/customers/hooks'
import { CUSTOMER_FIELDS, customerSchema, customerToForm, formToCustomer, type CustomerForm } from '@/features/customers/schemas'
import { applyApiErrors } from '@/lib/form-errors'
import type { CartCustomer } from '../store'

/** Choix du client à la caisse, avec création rapide (nom, téléphone facultatif, M10). */
export function CustomerPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (customer: CartCustomer) => void
}) {
  const { t } = useTranslation()
  const can = useCan()
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setQ(draft.trim()), 250)
    return () => clearTimeout(timer)
  }, [draft])

  const customers = useCustomers({ search: q || undefined, per_page: 20, filter: { is_active: 'true' } }, open && !creating)

  const close = () => {
    setDraft('')
    setCreating(false)
    onOpenChange(false)
  }

  return (
    <ResponsiveSheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} title={creating ? t('sales.pos.customer_new') : t('sales.pos.customer_choose')}>
      {creating ? (
        <QuickCreate
          initialName={draft}
          onCancel={() => setCreating(false)}
          onCreated={(c) => {
            onPick(c)
            close()
          }}
        />
      ) : (
        <div className="grid gap-4">
          <div className="relative">
            <label htmlFor="customer-search" className="sr-only">
              {t('sales.pos.customer_search')}
            </label>
            <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-muted-foreground" aria-hidden="true" />
            <Input
              id="customer-search"
              type="search"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('sales.pos.customer_search')}
              className="pl-10"
            />
          </div>
          {can('customers.create') && (
            <Button type="button" variant="outline" className="justify-self-start" onClick={() => setCreating(true)}>
              <UserPlus aria-hidden="true" />
              {t('sales.pos.customer_new')}
            </Button>
          )}
          {customers.isPending ? (
            <LoadingState rows={3} />
          ) : customers.isError ? (
            <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />
          ) : customers.data.data.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('list.no_result_title')}</p>
          ) : (
            <ul className="grid gap-2">
              {customers.data.data.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick({ id: c.id, name: c.name, phone: c.phone, balance: c.balance, creditNote: c.credit_note_balance })
                      close()
                    }}
                    className="pressable flex min-h-14 w-full items-center justify-between gap-3 rounded-md bg-card px-3 py-2 text-left"
                  >
                    <span className="grid min-w-0">
                      <span className="truncate font-bold">{c.name}</span>
                      <span className="truncate text-sm text-muted-foreground">{[c.phone, c.district].filter(Boolean).join(' · ')}</span>
                    </span>
                    {Number(c.balance) > 0 && (
                      <span className="grid shrink-0 justify-items-end text-xs text-muted-foreground">
                        {t('customers.due')}
                        <Money value={c.balance} className="text-sm text-destructive" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ResponsiveSheet>
  )
}

function QuickCreate({ initialName, onCancel, onCreated }: { initialName: string; onCancel: () => void; onCreated: (c: CartCustomer) => void }) {
  const { t } = useTranslation()
  const save = useSaveCustomer()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<CustomerForm>({ resolver: zodResolver(customerSchema), defaultValues: { ...customerToForm(), name: initialName } })

  const submit = form.handleSubmit((values) => {
    setError(null)
    save.mutate(formToCustomer(values), {
      onSuccess: (c) => onCreated({ id: c.id, name: c.name, phone: c.phone, balance: c.balance }),
      onError: (e) => setError(applyApiErrors(e, form.setError, CUSTOMER_FIELDS)),
    })
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <CustomerFields form={form} compact />
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('sales.pos.customer_create')}
        </Button>
      </div>
    </form>
  )
}
