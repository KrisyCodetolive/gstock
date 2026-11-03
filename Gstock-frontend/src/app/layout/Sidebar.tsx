import { ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/features/auth/components/UserMenu'
import { useSession } from '@/features/auth/hooks'
import { ShopSwitcher } from '@/features/shops/components/ShopSwitcher'
import { useAllowedNav } from './useAllowedNav'

/** Navigation latérale desktop (≥ 1024 px), même ordre que sur mobile. */
export function Sidebar() {
  const { t } = useTranslation()
  const { user, role, tenant } = useSession()
  const allowed = useAllowedNav()
  const sell = allowed.find((i) => i.id === 'sell')

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r-2 border-foreground bg-card px-4 py-5 lg:flex">
      <Link to="/" className="rounded-md px-1" aria-label={t('nav.home')}>
        <Logo />
      </Link>
      <div className="grid gap-1 px-1">
        <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{tenant.name}</span>
        <ShopSwitcher className="w-full justify-start" />
      </div>

      {sell && (
        <Button asChild size="lg">
          <Link to={sell.path}>
            <ShoppingCart strokeWidth={2.4} aria-hidden="true" />
            {t(sell.label)}
          </Link>
        </Button>
      )}

      <nav aria-label={t('nav.main')} className="-mx-1 flex-1 overflow-y-auto px-1">
        <ul className="grid gap-1">
          {allowed
            .filter((i) => i.id !== 'sell')
            .map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className="flex min-h-11 items-center gap-3 rounded-sm border-2 border-transparent px-3 text-[15px] font-semibold hover:bg-muted aria-[current=page]:border-foreground aria-[current=page]:bg-tint-lavender aria-[current=page]:font-bold"
                >
                  <item.icon className="size-5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t-2 border-muted pt-4">
        <UserMenu align="start" />
        <div className="grid min-w-0">
          <span className="truncate font-bold">
            {user.firstname} {user.lastname}
          </span>
          <span className="truncate text-sm text-muted-foreground">{role.name}</span>
        </div>
      </div>
    </aside>
  )
}
