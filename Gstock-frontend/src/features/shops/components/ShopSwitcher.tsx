import { Check, ChevronDown, Store } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useCurrentShop } from '../hooks'

/**
 * Boutique courante (§3.6). Un utilisateur qui n'a qu'une boutique voit son nom,
 * sans sélecteur ; avec plusieurs, il en change en un geste.
 */
export function ShopSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { shop, shops, setShopId } = useCurrentShop()
  const [open, setOpen] = useState(false)

  if (!shop) return null

  if (shops.length < 2) {
    return (
      <span className={cn('flex min-w-0 items-center gap-2 px-1 text-[15px] font-bold', className)}>
        <Store className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate">{shop.name}</span>
      </span>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          'pressable flex h-11 min-w-0 items-center gap-2 rounded-sm bg-card px-3 text-[15px] font-bold',
          className,
        )}
        aria-label={`${t('shop.switch')} (${t('shop.current')} : ${shop.name})`}
      >
        <Store className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate">{shop.name}</span>
        <ChevronDown className="size-4 shrink-0" strokeWidth={2.6} aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="bottom" className="sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2">
        <SheetHeader>
          <SheetTitle>{t('shop.choose_title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('shop.switch')}</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-3 px-4 pb-6">
          {shops.map((s) => {
            const active = s.id === shop.id
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setShopId(s.id)
                    setOpen(false)
                  }}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'pressable flex min-h-16 w-full items-center gap-3 rounded-md px-4 text-left',
                    active ? 'bg-primary text-primary-foreground' : 'bg-card',
                  )}
                >
                  <Store className="size-6 shrink-0" aria-hidden="true" />
                  <span className="grid flex-1">
                    <span className="text-base font-bold">{s.name}</span>
                    <span className={cn('text-sm', active ? 'opacity-85' : 'text-muted-foreground')}>
                      {[s.district, s.city].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  {active && <Check className="size-6" strokeWidth={2.6} aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
