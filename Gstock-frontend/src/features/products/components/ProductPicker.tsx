import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Money } from '@/components/Money'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { ErrorState, LoadingState } from '@/components/states'
import { ScanButton } from '@/components/BarcodeScanner'
import { Input } from '@/components/ui/input'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatQuantity } from '@/lib/format'
import { articleKey } from '@/lib/articles'
import type { ProductSearchResult } from '@/types/catalog'
import { useProductSearch } from '../hooks'
import { ProductThumb } from './ProductThumb'
import { StockStateBadge } from './StockStateBadge'

/**
 * Choix d'un produit de la boutique courante : recherche par nom, code ou
 * code-barres (un code-barres exact sort seul). Réutilisé par la caisse (F4).
 */
export function ProductPicker({
  open,
  onOpenChange,
  onPick,
  exclude = [],
  services = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (product: ProductSearchResult) => void
  /** Articles déjà choisis (clés articleKey) : affichés mais non sélectionnables. */
  exclude?: string[]
  services?: boolean
}) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQ(draft.trim()), 250)
    return () => clearTimeout(timer)
  }, [draft])

  const results = useProductSearch(open ? shop?.id : undefined, q, { services })

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setDraft('')
        onOpenChange(o)
      }}
      title={t('stock.picker.title')}
    >
      <div className="grid gap-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="picker-search" className="sr-only">
              {t('stock.picker.search')}
            </label>
            <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-muted-foreground" aria-hidden="true" />
            <Input
              id="picker-search"
              type="search"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('stock.picker.search')}
              className="pl-10"
            />
          </div>
          <ScanButton
            onDetected={(code) => {
              // Un code-barres exact ne renvoie que son produit (recherche serveur).
              setDraft(code)
              setQ(code)
            }}
          />
        </div>
        {results.isPending ? (
          <LoadingState rows={4} />
        ) : results.isError ? (
          <ErrorState error={results.error} onRetry={() => void results.refetch()} />
        ) : results.data.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">{t('stock.picker.empty')}</p>
        ) : (
          <ul className="grid gap-2" aria-busy={results.isFetching}>
            {results.data.map((p) => {
              const taken = exclude.includes(articleKey(p.id, p.variant_id))
              return (
                <li key={articleKey(p.id, p.variant_id)}>
                  <button
                    type="button"
                    disabled={taken}
                    onClick={() => {
                      onPick(p)
                      setDraft('')
                      onOpenChange(false)
                    }}
                    className="pressable flex min-h-16 w-full items-center gap-3 rounded-md bg-card px-3 py-2 text-left disabled:opacity-50"
                  >
                    <ProductThumb name={p.name} color={p.category?.color} imageUrl={p.image_url} type={p.type} className="size-10" />
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-bold">{p.name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                        <Money value={p.price} className="text-sm text-foreground" />
                        {p.quantity !== null && t('stock.picker.stock', { value: `${formatQuantity(p.quantity)} ${p.unit.short_name}` })}
                        {taken && <span className="font-semibold">{t('stock.picker.already')}</span>}
                      </span>
                    </span>
                    {p.state && p.state !== 'ok' && <StockStateBadge state={p.state} />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </ResponsiveSheet>
  )
}
