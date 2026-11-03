// Comptes de démonstration, affichés uniquement avec les données simulées.
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import { roleLabel } from '@/lib/roles'
import { shops } from '@/mocks/data/tenant'
import { DEMO_PASSWORD, roles, users } from '@/mocks/data/users'
import type { LoginForm } from '../schemas'
import { UserAvatar } from './UserAvatar'

export function DemoAccounts({ onPick, disabled }: { onPick: (account: LoginForm) => void; disabled?: boolean }) {
  const { t } = useTranslation()
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
    </section>
  )
}
