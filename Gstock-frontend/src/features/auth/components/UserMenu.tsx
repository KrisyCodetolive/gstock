import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout, useSession } from '../hooks'
import { UserAvatar } from './UserAvatar'

export function UserMenu({ align = 'end' }: { align?: 'start' | 'end' }) {
  const { t } = useTranslation()
  const { user, role } = useSession()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md" aria-label={t('user.menu')}>
        <UserAvatar user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={8}>
        <DropdownMenuLabel className="grid gap-0.5 px-3 py-2">
          <span className="text-base font-bold">
            {user.firstname} {user.lastname}
          </span>
          <span className="text-sm font-medium text-muted-foreground">{t('user.role', { role: role.name })}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => logout.mutate(undefined, { onSettled: () => navigate('/connexion', { replace: true }) })}
        >
          <LogOut aria-hidden="true" />
          {t('user.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
