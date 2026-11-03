import { Menu, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router'
import { ActionCard } from '@/components/ActionCard'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { BOTTOM_NAV_IDS } from '../navigation'
import { useAllowedNav } from './useAllowedNav'

/** Barre basse mobile : 5 entrées au plus, « Vendre » au centre et surélevé. */
export function BottomNav() {
  const { t } = useTranslation()
  const allowed = useAllowedNav()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const bottomIds: readonly string[] = BOTTOM_NAV_IDS
  const bar = BOTTOM_NAV_IDS.flatMap((id) => allowed.filter((i) => i.id === id))
  const rest = allowed.filter((i) => !bottomIds.includes(i.id))
  const moreActive = rest.some((i) => location.pathname.startsWith(i.path))

  return (
    <>
      <nav
        aria-label={t('nav.main')}
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-foreground bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex items-end justify-around px-1 pt-1.5 pb-2">
          {bar.map((item) =>
            item.id === 'sell' ? (
              <li key={item.id} className="flex-1">
                <NavLink to={item.path} className="group flex flex-col items-center gap-1 text-xs font-extrabold text-primary">
                  <span className="pressable -mt-7 grid size-14 place-items-center rounded-xl bg-primary text-primary-foreground group-aria-[current=page]:bg-action group-aria-[current=page]:text-action-foreground">
                    <ShoppingCart className="size-7" strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  {t(item.label)}
                </NavLink>
              </li>
            ) : (
              <li key={item.id} className="flex-1">
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className="flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground aria-[current=page]:font-extrabold aria-[current=page]:text-primary"
                >
                  <item.icon className="size-6" strokeWidth={2.2} aria-hidden="true" />
                  {t(item.shortLabel ?? item.label)}
                </NavLink>
              </li>
            ),
          )}
          {rest.length > 0 && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  'flex min-h-12 w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground',
                  moreActive && 'font-extrabold text-primary',
                )}
              >
                <Menu className="size-6" strokeWidth={2.2} aria-hidden="true" />
                {t('nav.more')}
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('nav.more_title')}</SheetTitle>
            <SheetDescription className="sr-only">{t('nav.main')}</SheetDescription>
          </SheetHeader>
          <ul className="grid gap-3 px-4 pb-6">
            {rest.map((item) => (
              <li key={item.id} onClick={() => setMoreOpen(false)}>
                <ActionCard to={item.path} icon={item.icon} title={t(item.label)} tint={item.tint} />
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
