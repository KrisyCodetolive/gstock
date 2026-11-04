// Comptes de démonstration, affichés uniquement avec les données simulées.
import { ChevronRight, RotateCcw, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { resetAllMocks } from '@/mocks/db'
import { DEMO_SLUG, platform, PLATFORM_DOMAIN, switchCurrentTenant } from '@/mocks/platform'
import { roleLabel } from '@/lib/roles'
import { shops } from '@/mocks/data/tenant'
import { DEMO_PASSWORD, roles, users } from '@/mocks/data/users'
import type { LoginForm } from '../schemas'
import { UserAvatar } from './UserAvatar'

/** Ouvre un autre espace simulé, comme si l'on allait sur son sous-domaine. */
function openSpace(slug: string) {
  switchCurrentTenant(slug)
  window.location.reload()
}

export function DemoAccounts({ onPick, disabled }: { onPick: (account: LoginForm) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  if (platform.current !== DEMO_SLUG) return <SpaceSwitcher />
  return (
    <section className="grid gap-3" aria-labelledby="demo-title">
      <div className="grid gap-0.5">
        <h2 id="demo-title" className="text-lg font-bold">
          {t('auth.demo_title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('auth.demo_text', { password: DEMO_PASSWORD })}</p>
      </div>
      <ul className="grid gap-2.5">
        {users.map((user) => {
          const role = roles.find((r) => r.id === user.role_id)
          const userShops = role?.is_owner ? shops : shops.filter((s) => user.shop_ids.includes(s.id))
          return (
            <li key={user.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick({ login: user.email ?? '', password: user.password })}
                className="pressable flex min-h-16 w-full items-center gap-3 rounded-md bg-card px-3 py-2 text-left disabled:opacity-60"
              >
                <UserAvatar user={user} />
                <span className="grid min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-bold">
                    {user.firstname} {user.lastname}
                    {!user.is_active && <StatusBadge tone="danger">{t('auth.demo_inactive')}</StatusBadge>}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {role && roleLabel(role)} · {userShops.map((s) => s.name.replace('Boutique ', '')).join(', ')}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          resetAllMocks()
          toast.success(t('auth.demo_reset_done'))
          setTimeout(() => window.location.reload(), 600)
        }}
      >
        <RotateCcw aria-hidden="true" />
        {t('auth.demo_reset')}
      </Button>
      <OtherSpaces />
    </section>
  )
}

function OtherSpaces() {
  const { t } = useTranslation()
  const others = platform.tenants.filter((x) => x.slug !== platform.current)
  if (others.length === 0) return null
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-bold">{t('simulation.other_spaces')}</h3>
      <ul className="grid gap-2">
        {others.map((x) => (
          <li key={x.slug}>
            <button type="button" onClick={() => openSpace(x.slug)} className="pressable flex min-h-14 w-full items-center gap-3 rounded-md bg-card px-3 text-left">
              <Store className="size-5 shrink-0" aria-hidden="true" />
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-bold">{x.name}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {x.slug}.{PLATFORM_DOMAIN}
                </span>
              </span>
              <span className="text-sm font-bold text-primary">{t('simulation.open_space')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Espace créé par une inscription : ses comptes ne sont pas ceux de la démonstration. */
function SpaceSwitcher() {
  const { t } = useTranslation()
  const tenant = platform.tenants.find((x) => x.slug === platform.current)
  return (
    <section className="grid gap-3 rounded-lg border-2 border-dashed border-muted-foreground p-4">
      <div className="grid gap-0.5">
        <h2 className="text-lg font-bold">{t('simulation.space', { name: tenant?.name ?? platform.current })}</h2>
        <p className="text-sm text-muted-foreground">{t('simulation.space_url', { url: `${platform.current}.${PLATFORM_DOMAIN}` })}</p>
      </div>
      <Button type="button" variant="outline" className="justify-self-start" onClick={() => openSpace(DEMO_SLUG)}>
        {t('simulation.to_demo')}
      </Button>
      <OtherSpaces />
    </section>
  )
}
