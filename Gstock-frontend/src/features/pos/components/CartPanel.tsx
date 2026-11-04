import { CreditCard, PauseCircle, ShoppingBasket, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Money } from '@/components/Money'
import { QuantityInput } from '@/components/QuantityInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan } from '@/features/auth/hooks'
import { formatQuantity } from '@/lib/format'
import type { Id } from '@/types/api'
import type { SaleQuote } from '@/types/sales'
import { usePosStore, type Cart } from '../store'
import { LineEditor } from './LineEditor'
import type { PosProduct } from './ProductGrid'

/**
 * Panier : lignes, total calculé par le serveur, actions « Encaisser » (action
 * principale), « Mettre à crédit » et « Mettre en attente » (M08).
 */
export function CartPanel({
  shopId,
  cart,
  products,
  quote,
  computing,
  quoteError,
  onCheckout,
  onCredit,
}: {
  shopId: Id
  cart: Cart
  products: Map<Id, PosProduct>
  quote: SaleQuote | undefined
  computing: boolean
  quoteError: string | null
  onCheckout: () => void
  onCredit: () => void
}) {
  const { t } = useTranslation()
  const can = useCan()
  const store = usePosStore()
  const [editing, setEditing] = useState<Id | null>(null)
  const count = cart.lines.reduce((s, l) => s + l.quantity, 0)
  const empty = cart.lines.length === 0
  const ready = !empty && quote !== undefined && !computing && !quoteError

  const setQty = (productId: Id, value: string) => {
    const n = Number(value.replace(',', '.'))
    if (!Number.isFinite(n)) return
    const p = products.get(productId)
    // Pas plus que le stock disponible (§7.2) ; un service n'a pas de limite.
    if (p && p.quantity !== null && n > Number(p.quantity)) {
      toast.warning(t('sales.pos.max_reached', { value: `${formatQuantity(p.quantity)} ${p.unit.short_name}` }))
      store.setQuantity(shopId, productId, Number(p.quantity))
      return
    }
    store.setQuantity(shopId, productId, n)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-muted px-4 py-3">
        <h2 className="text-lg font-bold">
          {t('sales.pos.cart')} {count > 0 && <span className="text-muted-foreground">· {t('sales.pos.items', { count })}</span>}
        </h2>
        {!empty && (
          <Button variant="ghost" size="sm" onClick={() => store.clear(shopId)}>
            <Trash2 aria-hidden="true" />
            {t('sales.pos.clear')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {empty ? (
          <div className="grid justify-items-center gap-3 py-10 text-center text-muted-foreground">
            <ShoppingBasket className="size-10" aria-hidden="true" />
            <p>{t('sales.pos.cart_empty')}</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {cart.lines.map((line) => {
              const p = products.get(line.productId)
              const q = quote?.items.find((i) => i.product_id === line.productId)
              return (
                <li key={line.productId} className="grid gap-2 border-b-2 border-muted pb-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="grid min-w-0 text-left"
                      onClick={() => setEditing(line.productId)}
                      aria-label={t('sales.pos.edit_line', { name: p?.name ?? '' })}
                    >
                      <span className="font-bold leading-tight">{p?.name ?? '…'}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatQuantity(line.quantity)} × {Number(q?.price ?? line.price ?? p?.price ?? 0).toLocaleString('fr-FR')} FCFA
                        {q && Number(q.discount_amount) > 0 && ` · ${t('sales.detail.with_discount', { amount: Number(q.discount_amount).toLocaleString('fr-FR') })}`}
                      </span>
                    </button>
                    <span className="shrink-0 text-right">{q ? <Money value={q.subtotal} /> : <span className="text-muted-foreground">…</span>}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <QuantityInput
                      id={`cart-qty-${line.productId}`}
                      value={String(line.quantity)}
                      onChange={(v) => setQty(line.productId, v)}
                      label={`${t('stock.form.quantity')} — ${p?.name ?? ''}`}
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => store.remove(shopId, line.productId)} aria-label={t('sales.pos.remove', { name: p?.name ?? '' })}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!empty && can('sales.give_discount') && (
          <div className="mt-4 grid gap-2">
            <label htmlFor="global-discount" className="text-sm font-semibold">
              {t('sales.pos.discount_global')} (FCFA)
            </label>
            <Input
              id="global-discount"
              inputMode="numeric"
              className="tabular"
              value={cart.discount ?? ''}
              onChange={(e) => store.setDiscount(shopId, e.target.value || undefined)}
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 border-t-2 border-foreground bg-card px-4 py-3">
        {quoteError && <p className="text-sm font-semibold text-destructive">{quoteError}</p>}
        <div className="flex items-end justify-between gap-2" aria-live="polite">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('sales.pos.total')}
            {quote && Number(quote.discount) > 0 && ` (${t('sales.detail.discount').toLowerCase()} ${Number(quote.discount).toLocaleString('fr-FR')})`}
          </span>
          {computing && !quote ? (
            <span className="text-muted-foreground">{t('sales.pos.computing')}</span>
          ) : (
            <Money value={empty ? '0' : (quote?.total ?? '0')} size="lg" className={computing ? 'opacity-50' : undefined} />
          )}
        </div>
        <Button variant="action" size="lg" disabled={!ready} onClick={onCheckout}>
          <Wallet strokeWidth={2.4} aria-hidden="true" />
          {t('sales.pos.checkout')}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {can('credits.create') && (
            <Button disabled={!ready} onClick={onCredit}>
              <CreditCard aria-hidden="true" />
              {t('sales.pos.credit')}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={empty}
            className={can('credits.create') ? undefined : 'col-span-2'}
            onClick={() => {
              store.hold(shopId)
              toast.info(t('sales.pos.held'))
            }}
          >
            <PauseCircle aria-hidden="true" />
            {t('sales.pos.hold')}
          </Button>
        </div>
      </div>

      {editing !== null && products.get(editing) && (
        <LineEditor
          shopId={shopId}
          product={products.get(editing)!}
          line={cart.lines.find((l) => l.productId === editing)!}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
