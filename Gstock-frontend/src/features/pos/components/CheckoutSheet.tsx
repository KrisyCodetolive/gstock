import { CheckCircle2, CloudOff, CreditCard, Loader2, Plus, ReceiptText, Smartphone, Trash2, UserRound, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormAlert } from '@/components/FormField'
import { Money } from '@/components/Money'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCan, useSession } from '@/features/auth/hooks'
import { ApiError } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/form-errors'
import type { Id } from '@/types/api'
import { useOnline } from '@/offline/network'
import type { OfflineOperation } from '@/offline/queue'
import type { ProvisionalQuote } from '@/offline/quote'
import type { PosBootstrap, Sale, SalePaymentInput } from '@/types/sales'
import { cartToInput, useCreateSale, useSaleConfirmation, useSaleQuote } from '../hooks'
import { usePosStore, type Cart } from '../store'
import { CustomerPicker } from './CustomerPicker'

interface PaymentRow {
  key: string
  methodId: Id
  /** Paiement avec l'avoir du client (décision P3). */
  creditNote?: boolean
  amount: string
  cashGiven: string
}

const clean = (v: string) => v.replace(/\s/g, '').replace(',', '.')

/** Billets usuels en FCFA, pour proposer la somme donnée en un toucher. */
function cashSuggestions(amount: number): number[] {
  const steps = [500, 1000, 2000, 5000, 10000]
  return [...new Set(steps.map((s) => Math.ceil(amount / s) * s).filter((v) => v > amount))].slice(0, 3)
}

/**
 * Encaissement (M08) : espèces avec rendu, paiement mixte, partiel ou à crédit.
 * Le total, l'argent reçu, le reste et le rendu viennent du serveur (§7.4, §7.5).
 */
export function CheckoutSheet({
  shopId,
  cart,
  initialMode,
  total,
  bootstrap,
  shopName,
  onClose,
}: {
  shopId: Id
  cart: Cart
  initialMode: 'paid' | 'credit'
  total: string
  bootstrap: PosBootstrap
  shopName: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const can = useCan()
  const me = useSession()
  const online = useOnline()
  // Pas de paiement GeniusPay sans réseau (ADR-005).
  const methods = online ? bootstrap.payment_methods : bootstrap.payment_methods.filter((m) => !m.uses_geniuspay)
  const store = usePosStore()
  const create = useCreateSale(shopId)
  const [mode, setMode] = useState(initialMode)
  // Idempotence : réessayer après une coupure ne crée pas deux ventes (ADR-005).
  const [offlineUuid] = useState(() => crypto.randomUUID())
  const cash = methods.find((m) => m.type === 'cash') ?? methods[0]
  const [rows, setRows] = useState<PaymentRow[]>(() =>
    initialMode === 'paid' && cash ? [{ key: crypto.randomUUID(), methodId: cash.id, amount: String(Number(total)), cashGiven: '' }] : [],
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sale, setSale] = useState<Sale | null>(null)
  const [offlineSale, setOfflineSale] = useState<{ operation: OfflineOperation; quote: ProvisionalQuote } | null>(null)

  const payments: SalePaymentInput[] = rows
    .filter((r) => Number(clean(r.amount)) > 0)
    .map((r) => {
      if (r.creditNote) return { payment_method_id: null, credit_note: true, amount: clean(r.amount) }
      const method = methods.find((m) => m.id === r.methodId)
      return {
        payment_method_id: r.methodId,
        amount: clean(r.amount),
        ...(method?.type === 'cash' && r.cashGiven ? { cash_given: clean(r.cashGiven) } : {}),
      }
    })
  const quote = useSaleQuote(sale || offlineSale ? undefined : shopId, cartToInput(cart, payments), bootstrap)
  const q = quote.data
  const quoteError = quote.error instanceof ApiError ? apiErrorMessage(quote.error) : null
  const missing = q ? Number(q.credit_amount) : 0
  const needsCustomer = missing > 0 && !cart.customer
  // L'avoir est vérifié par le serveur : il s'utilise avec le réseau.
  const creditNote = online ? Number(cart.customer?.creditNote ?? 0) : 0

  const update = (key: string, changes: Partial<PaymentRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)))

  const confirm = () => {
    setError(null)
    if (mode === 'credit' && !cart.customer) {
      setError(t('sales.pos.customer_required'))
      return
    }
    create.mutate(
      {
        payload: { ...cartToInput(cart, payments), customer_id: cart.customer?.id ?? null, offline_uuid: offlineUuid },
        context: { bootstrap, shopName, userId: me.user.id, customerName: cart.customer?.name ?? null },
      },
      {
        onSuccess: (result) => {
          if (result.kind === 'online') setSale(result.sale)
          else setOfflineSale(result)
          store.clear(shopId)
        },
        onError: (e) => setError(apiErrorMessage(e)),
      },
    )
  }

  if (sale) return <SaleDone shopId={shopId} sale={sale} onClose={onClose} />
  if (offlineSale) return <OfflineSaleDone {...offlineSale} customer={cart.customer?.name ?? null} onClose={onClose} />

  const canConfirm = q && !quote.isFetching && !quoteError && (mode === 'credit' ? Boolean(cart.customer) : missing === 0)

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={mode === 'credit' ? t('sales.pos.credit_title') : t('sales.pos.pay_title')}>
      <div className="grid gap-5">
        <div className="flex items-end justify-between gap-2 rounded-lg border-2 border-foreground bg-tint-lavender p-4">
          <span className="font-semibold">{t('sales.pos.to_pay')}</span>
          <Money value={q?.total ?? total} size="lg" />
        </div>
        {!online && (
          <p className="flex gap-2 rounded-md border-2 border-warn bg-warn-bg p-3 text-sm font-semibold text-warn" role="status">
            <CloudOff className="size-5 shrink-0" aria-hidden="true" />
            {t('offline.provisional')}. {bootstrap.payment_methods.some((m) => m.uses_geniuspay) && t('offline.geniuspay_unavailable')}
          </p>
        )}

        <section className="grid gap-2" aria-labelledby="checkout-customer">
          <h3 id="checkout-customer" className="text-sm font-semibold">
            {t('sales.pos.customer')}
          </h3>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="pressable flex min-h-14 items-center gap-3 rounded-md bg-card px-3 text-left"
            aria-invalid={mode === 'credit' && !cart.customer ? true : undefined}
          >
            <UserRound className="size-5 shrink-0" aria-hidden="true" />
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-bold">{cart.customer?.name ?? (mode === 'credit' ? t('sales.pos.customer_choose') : t('sales.pos.customer_none'))}</span>
              {cart.customer && Number(cart.customer.balance) > 0 && (
                <span className="text-sm text-destructive">{t('sales.pos.customer_due', { amount: Number(cart.customer.balance).toLocaleString('fr-FR') })}</span>
              )}
              {cart.customer && Number(cart.customer.creditNote ?? 0) > 0 && (
                <span className="text-sm font-semibold text-primary">{t('sales.pos.customer_credit_note', { amount: Number(cart.customer.creditNote).toLocaleString('fr-FR') })}</span>
              )}
            </span>
            <span className="text-sm font-bold text-primary">{t('sales.pos.customer_change')}</span>
          </button>
        </section>

        <section className="grid gap-3" aria-labelledby="checkout-payments">
          <h3 id="checkout-payments" className="text-sm font-semibold">
            {mode === 'credit' ? t('sales.pos.paid_part') : t('sales.pos.received')}
          </h3>
          {rows.map((row) => {
            const method = methods.find((m) => m.id === row.methodId)
            const amount = Number(clean(row.amount)) || 0
            if (row.creditNote) {
              return (
                <div key={row.key} className="grid gap-2 rounded-md border-2 border-foreground bg-tint-lavender p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{t('sales.detail.credit_note')}</span>
                    <Button variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))} aria-label={t('sales.pos.remove_payment')}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-semibold">{t('sales.pos.amount')} (FCFA)</span>
                    <Input inputMode="numeric" className="tabular text-lg font-bold" value={row.amount} onChange={(e) => update(row.key, { amount: e.target.value })} />
                  </label>
                </div>
              )
            }
            return (
              <div key={row.key} className="grid gap-3 rounded-md border-2 border-foreground p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Select value={String(row.methodId)} onValueChange={(v) => update(row.key, { methodId: Number(v), cashGiven: '' })}>
                    <SelectTrigger aria-label={t('sales.pos.method')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))} aria-label={t('sales.pos.remove_payment')}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">{t('sales.pos.amount')} (FCFA)</span>
                  <Input inputMode="numeric" className="tabular text-lg font-bold" value={row.amount} onChange={(e) => update(row.key, { amount: e.target.value })} />
                </label>
                {method?.type === 'cash' && amount > 0 && (
                  <div className="grid gap-2">
                    <label className="grid gap-1.5">
                      <span className="text-sm font-semibold">{t('sales.pos.cash_given')} (FCFA)</span>
                      <Input inputMode="numeric" className="tabular" value={row.cashGiven} onChange={(e) => update(row.key, { cashGiven: e.target.value })} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => update(row.key, { cashGiven: String(amount) })}>
                        {t('sales.pos.exact')}
                      </Button>
                      {cashSuggestions(amount).map((v) => (
                        <Button key={v} type="button" variant="outline" size="sm" className="tabular" onClick={() => update(row.key, { cashGiven: String(v) })}>
                          {v.toLocaleString('fr-FR')}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {method?.uses_geniuspay && (
                  <p className="flex gap-2 text-sm text-muted-foreground">
                    <Smartphone className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    {t('sales.pos.geniuspay_hint')}
                  </p>
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows((rs) => [...rs, { key: crypto.randomUUID(), methodId: (methods.find((m) => m.type !== 'cash') ?? cash)!.id, amount: String(missing > 0 ? missing : ''), cashGiven: '' }])}
            >
              <Plus aria-hidden="true" />
              {t('sales.pos.add_payment')}
            </Button>
            {creditNote > 0 && !rows.some((r) => r.creditNote) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // L'avoir passe en premier : les autres paiements couvrent le reste.
                  const use = Math.min(creditNote, Number(q?.total ?? total))
                  setRows((rs) => [
                    { key: crypto.randomUUID(), methodId: cash!.id, creditNote: true, amount: String(use), cashGiven: '' },
                    ...rs.map((r, i) => (i === 0 && !r.creditNote ? { ...r, amount: String(Math.max(0, Number(clean(r.amount)) - use)) } : r)),
                  ])
                }}
              >
                <Wallet aria-hidden="true" />
                {t('sales.pos.use_credit_note', { amount: creditNote.toLocaleString('fr-FR') })}
              </Button>
            )}
          </div>
        </section>

        {q && (
          <dl className="grid gap-1 rounded-md bg-muted p-3 text-[15px]" aria-live="polite">
            <div className="flex justify-between gap-2">
              <dt>{t('sales.pos.received')}</dt>
              <dd><Money value={q.paid_now} /></dd>
            </div>
            {Number(q.change) > 0 && (
              <div className="flex justify-between gap-2 font-bold text-paid-ink">
                <dt>{t('sales.pos.change')}</dt>
                <dd><Money value={q.change} size="md" /></dd>
              </div>
            )}
            {missing > 0 && (
              <div className="flex justify-between gap-2 font-bold text-destructive">
                <dt>{mode === 'credit' ? t('sales.pos.credit_part') : t('sales.pos.rest')}</dt>
                <dd><Money value={q.credit_amount} size="md" /></dd>
              </div>
            )}
          </dl>
        )}

        {quoteError && <FormAlert>{quoteError}</FormAlert>}
        {mode === 'paid' && missing > 0 && !quoteError && (
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-destructive">{t('sales.pos.missing', { amount: missing.toLocaleString('fr-FR') })}</p>
            {can('credits.create') && (
              <Button type="button" onClick={() => setMode('credit')} className="justify-self-start">
                <CreditCard aria-hidden="true" />
                {t('sales.pos.credit')}
              </Button>
            )}
          </div>
        )}
        {mode === 'credit' && needsCustomer && <p className="text-sm font-semibold text-destructive">{t('sales.pos.customer_required')}</p>}
        {error && <FormAlert>{error}</FormAlert>}

        <div className="sticky -bottom-4 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-muted bg-popover px-4 py-3">
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="action" size="lg" disabled={!canConfirm || create.isPending} onClick={confirm}>
            {create.isPending ? t('sales.pos.saving') : mode === 'credit' ? t('sales.pos.confirm_credit') : t('sales.pos.confirm_paid')}
          </Button>
        </div>
      </div>

      <CustomerPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={(c) => store.setCustomer(shopId, c)} offlineCustomers={bootstrap.customers} />
    </ResponsiveSheet>
  )
}

/** Fin de vente : rendu à donner, crédit créé, confirmation GeniusPay, reçu. */
function SaleDone({ shopId, sale, onClose }: { shopId: Id; sale: Sale; onClose: () => void }) {
  const { t } = useTranslation()
  const pending = sale.payments.some((p) => p.status === 'pending')
  const tracked = useSaleConfirmation(shopId, sale.id, pending)
  const stillPending = (tracked.data ?? sale).payments.some((p) => p.status === 'pending')
  const change = sale.payments.reduce((s, p) => s + Number(p.change ?? 0), 0)

  useEffect(() => {
    if (pending && tracked.data && !stillPending) toast.success(t('sales.pos.geniuspay_confirmed'))
  }, [pending, stillPending, tracked.data, t])

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={t('sales.pos.done_title', { reference: sale.reference })}>
      <div className="grid gap-5 text-center">
        <CheckCircle2 className="mx-auto size-16 text-paid-ink" aria-hidden="true" />
        <Money value={sale.total} size="lg" className="justify-self-center" />
        {change > 0 && (
          <p className="rounded-lg border-2 border-foreground bg-tint-mint p-4 text-xl font-extrabold">
            {t('sales.pos.done_change', { amount: change.toLocaleString('fr-FR') })}
          </p>
        )}
        {Number(sale.credit_amount) > 0 && sale.customer && (
          <p className="rounded-lg border-2 border-foreground bg-destructive-bg p-4 font-bold text-destructive">
            {t('sales.pos.done_credit', { amount: Number(sale.credit_amount).toLocaleString('fr-FR'), name: sale.customer.name })}
          </p>
        )}
        {stillPending && (
          <p className="flex items-center justify-center gap-2 font-semibold text-primary" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {t('sales.pos.waiting_geniuspay')}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" size="lg">
            <Link to={`/ventes/${sale.id}/recu`}>
              <ReceiptText aria-hidden="true" />
              {t('sales.detail.receipt')}
            </Link>
          </Button>
          <Button variant="action" size="lg" onClick={onClose} autoFocus>
            {t('sales.pos.new_sale')}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  )
}

/** Fin de vente sans réseau : la vente est gardée sur l'appareil avec une référence provisoire (ADR-005). */
function OfflineSaleDone({ operation, quote, customer, onClose }: { operation: OfflineOperation; quote: ProvisionalQuote; customer: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const change = Number(quote.change)
  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={t('offline.sale_done_title', { reference: operation.provisional_reference })}>
      <div className="grid gap-5 text-center">
        <CloudOff className="mx-auto size-16 text-warn" aria-hidden="true" />
        <Money value={quote.total} size="lg" className="justify-self-center" />
        {change > 0 && (
          <p className="rounded-lg border-2 border-foreground bg-tint-mint p-4 text-xl font-extrabold">
            {t('sales.pos.done_change', { amount: change.toLocaleString('fr-FR') })}
          </p>
        )}
        {Number(quote.credit_amount) > 0 && customer && (
          <p className="rounded-lg border-2 border-foreground bg-destructive-bg p-4 font-bold text-destructive">
            {t('sales.pos.done_credit', { amount: Number(quote.credit_amount).toLocaleString('fr-FR'), name: customer })}
          </p>
        )}
        <p className="rounded-md border-2 border-warn bg-warn-bg p-3 text-sm font-semibold text-warn">{t('offline.sale_done_text')}</p>
        <Button variant="action" size="lg" onClick={onClose} autoFocus>
          {t('sales.pos.new_sale')}
        </Button>
      </div>
    </ResponsiveSheet>
  )
}
