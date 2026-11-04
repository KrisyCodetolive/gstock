import { ArrowLeft, Clock, Search, ShoppingBasket, Trash2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Money } from '@/components/Money'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { ScanButton } from '@/components/BarcodeScanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { ShopSwitcher } from '@/features/shops/components/ShopSwitcher'
import { useCurrentShop } from '@/features/shops/hooks'
import { ApiError } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDateTime, formatQuantity } from '@/lib/format'
import { useIsDesktop } from '@/lib/use-media-query'
import { normalizeText } from '@/lib/text'
import { cn } from '@/lib/utils'
import type { Id } from '@/types/api'
import { CartPanel } from '../components/CartPanel'
import { CheckoutSheet } from '../components/CheckoutSheet'
import { ProductGrid, type PosProduct } from '../components/ProductGrid'
import { cartToInput, usePosBootstrap, useSaleQuote } from '../hooks'
import { useCart, useHeldCarts, usePosStore } from '../store'
import { OfflineIndicator } from '@/features/sync/components/OfflineIndicator'
import { useAutoSync } from '@/offline/hooks'

/** Écran de vente plein écran (M08) : « Vendre » en quelques secondes. */
export function PosPage() {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const desktop = useIsDesktop()
  const bootstrap = usePosBootstrap(shop?.id)
  // La caisse est hors de la mise en page habituelle : elle lance aussi la synchronisation.
  useAutoSync()
  const cart = useCart(shop?.id)
  const held = useHeldCarts(shop?.id)
  const store = usePosStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Id | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [heldOpen, setHeldOpen] = useState(false)
  const [checkout, setCheckout] = useState<'paid' | 'credit' | null>(null)

  const quote = useSaleQuote(shop?.id, cart.lines.length ? cartToInput(cart) : null, bootstrap.data)
  const quoteError = quote.error instanceof ApiError ? apiErrorMessage(quote.error) : null

  const products = useMemo(() => new Map((bootstrap.data?.products ?? []).map((p) => [p.id, p])), [bootstrap.data])
  const quantities = useMemo(() => new Map(cart.lines.map((l) => [l.productId, l.quantity])), [cart.lines])
  const visible = useMemo(() => {
    const needle = normalizeText(search)
    return (bootstrap.data?.products ?? []).filter(
      (p) =>
        (category === null || p.category?.id === category) &&
        (!needle || normalizeText(`${p.name} ${p.code} ${p.barcode ?? ''}`).includes(needle)),
    )
  }, [bootstrap.data, search, category])

  if (!shop) return <EmptyState title={t('sales.pos.no_shop')} />

  /** Ajout instantané, sans dépasser le stock disponible (§7.2). */
  const add = (p: PosProduct) => {
    const inCart = quantities.get(p.id) ?? 0
    if (p.quantity !== null && inCart + 1 > Number(p.quantity)) {
      toast.warning(
        Number(p.quantity) <= 0
          ? t('sales.pos.out_of_stock', { name: p.name })
          : t('sales.pos.max_reached', { value: `${formatQuantity(p.quantity)} ${p.unit.short_name}` }),
      )
      return
    }
    store.add(shop.id, p.id)
  }

  /** Entrée dans la recherche : un code-barres exact ajoute directement le produit (douchette). */
  const onSearchEnter = (value = search) => {
    const code = value.trim()
    if (!code) return
    const match = bootstrap.data?.products.find((p) => p.barcode === code)
    if (match) {
      add(match)
      toast.success(t('sales.pos.barcode_added', { name: match.name }))
      setSearch('')
    } else if (/^\d{8,14}$/.test(code) || value !== search) {
      // Code inconnu : on le laisse dans la recherche pour que l'on voie ce qui a été lu.
      setSearch(code)
      toast.error(t('sales.pos.barcode_unknown'))
    }
  }

  const count = cart.lines.reduce((s, l) => s + l.quantity, 0)
  const openCheckout = (mode: 'paid' | 'credit') => {
    setCartOpen(false)
    setCheckout(mode)
  }

  const panel = (
    <CartPanel
      shopId={shop.id}
      cart={cart}
      products={products}
      quote={quote.data}
      computing={quote.isFetching}
      quoteError={quoteError}
      onCheckout={() => openCheckout('paid')}
      onCredit={() => openCheckout('credit')}
    />
  )

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:h-dvh lg:grid-cols-[1fr_400px]">
      <div className="flex min-w-0 flex-col lg:overflow-y-auto">
        <header className="sticky top-0 z-30 grid gap-3 border-b-2 border-foreground bg-background px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
          <div className="flex items-center justify-between gap-2">
            <Button asChild variant="ghost" size="icon-sm">
              <Link to="/" aria-label={t('sales.pos.quit')}>
                <ArrowLeft className="size-6" aria-hidden="true" />
              </Link>
            </Button>
            <ShopSwitcher className="min-w-0 flex-1" variant={desktop ? 'menu' : 'sheet'} />
            <OfflineIndicator />
            <Button variant="outline" size="sm" onClick={() => setHeldOpen(true)} aria-label={t('sales.pos.held_carts')}>
              <Clock aria-hidden="true" />
              <span className="tabular">{held.length}</span>
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="pos-search" className="sr-only">
                {t('sales.pos.search')}
              </label>
              <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-muted-foreground" aria-hidden="true" />
              <Input
                id="pos-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
                placeholder={t('sales.pos.search')}
                className="pl-10"
                autoComplete="off"
              />
            </div>
            <ScanButton onDetected={(code) => onSearchEnter(code)} />
          </div>
          {bootstrap.data && bootstrap.data.categories.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('products.filter_category')}>
              {[{ id: null, name: t('sales.pos.all') }, ...bootstrap.data.categories].map((c) => (
                <button
                  key={c.id ?? 'all'}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'min-h-10 shrink-0 rounded-sm border-2 border-foreground px-3 text-sm font-bold whitespace-nowrap',
                    category === c.id ? 'bg-foreground text-background' : 'bg-card',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="flex-1 px-4 pt-4 pb-32 lg:pb-6">
          {bootstrap.isPending ? (
            <LoadingState rows={6} />
          ) : bootstrap.isError ? (
            <ErrorState error={bootstrap.error} onRetry={() => void bootstrap.refetch()} />
          ) : bootstrap.data.products.length === 0 ? (
            <EmptyState icon={ShoppingBasket} title={t('sales.pos.empty_catalog')} />
          ) : visible.length === 0 ? (
            <EmptyState title={t('sales.pos.no_result')} />
          ) : (
            <ProductGrid products={visible} quantities={quantities} onAdd={add} />
          )}
        </main>
      </div>

      {/* Desktop : panier toujours visible à droite. */}
      <aside className="hidden border-l-2 border-foreground bg-card lg:block lg:h-dvh">{desktop && panel}</aside>

      {/* Mobile : bandeau du panier en bas (maquette « Marché »), qui ouvre le panier. */}
      {!desktop && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div className="pressable-lg flex items-center gap-3 rounded-lg bg-primary p-2 pl-4 text-primary-foreground">
              <button type="button" className="grid min-w-0 flex-1 text-left" onClick={() => setCartOpen(true)} aria-label={t('sales.pos.see_cart')}>
                <span className="text-xs opacity-85">{t('sales.pos.items', { count })}</span>
                <Money value={cart.lines.length ? (quote.data?.total ?? '0') : '0'} size="md" className={quote.isFetching ? 'opacity-60' : undefined} />
              </button>
              <Button
                variant="action"
                size="lg"
                disabled={cart.lines.length === 0 || !quote.data || quote.isFetching || Boolean(quoteError)}
                onClick={() => openCheckout('paid')}
              >
                <Wallet strokeWidth={2.4} aria-hidden="true" />
                {t('sales.pos.checkout')}
              </Button>
            </div>
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetContent side="bottom" className="h-[88dvh] gap-0 p-0" showCloseButton>
              <SheetTitle className="sr-only">{t('sales.pos.cart')}</SheetTitle>
              <SheetDescription className="sr-only">{t('sales.pos.see_cart')}</SheetDescription>
              {panel}
            </SheetContent>
          </Sheet>
        </>
      )}

      <ResponsiveSheet open={heldOpen} onOpenChange={setHeldOpen} title={t('sales.pos.held_carts')}>
        {held.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">{t('sales.pos.no_held')}</p>
        ) : (
          <ul className="grid gap-3">
            {held.map((h) => (
              <li key={h.id} className="flex items-center gap-2 rounded-md border-2 border-foreground p-3">
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-bold">{h.customer?.name ?? t('sales.pos.customer_none')}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('sales.pos.held_label', { count: h.lines.reduce((s, l) => s + l.quantity, 0), time: formatDateTime(h.heldAt) })}
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    store.resume(shop.id, h.id)
                    setHeldOpen(false)
                  }}
                >
                  {t('sales.pos.resume')}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => store.drop(shop.id, h.id)} aria-label={t('sales.pos.drop')}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ResponsiveSheet>

      {checkout && quote.data && bootstrap.data && (
        <CheckoutSheet
          shopId={shop.id}
          cart={cart}
          initialMode={checkout}
          total={quote.data.total}
          bootstrap={bootstrap.data}
          shopName={shop.name}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  )
}
