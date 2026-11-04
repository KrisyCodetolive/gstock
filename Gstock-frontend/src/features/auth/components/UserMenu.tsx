import { Download, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { roleLabel } from '@/lib/roles'
import { useOfflineCounts } from '@/offline/hooks'
import { promptInstall, useInstallStore } from '@/offline/install'
import { useLogout, useSession } from '../hooks'
import { UserAvatar } from './UserAvatar'

export function UserMenu({ align = 'end' }: { align?: 'start' | 'end' }) {
  const { t } = useTranslation()
  const { user, role } = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  const { pending } = useOfflineCounts()
  const canInstall = useInstallStore((s) => s.prompt !== null)
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md" aria-label={t('user.menu')}>
          <UserAvatar user={user} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} sideOffset={8}>
          <DropdownMenuLabel className="grid gap-0.5 px-3 py-2">
            <span className="text-base font-bold">
              {user.firstname} {user.lastname}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{t('user.role', { role: roleLabel(role) })}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void navigate('/profil')}>
            <UserRound aria-hidden="true" />
            {t('user.profile')}
          </DropdownMenuItem>
          {canInstall && (
            <DropdownMenuItem onSelect={() => void promptInstall().then((ok) => ok && toast.success(t('offline.install_done')))}>
              <Download aria-hidden="true" />
              {t('offline.install')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            // Des opérations faites sans réseau attendent : on prévient avant de partir.
            onSelect={() => (pending > 0 ? setConfirmLogout(true) : logout.mutate())}
          >
            <LogOut aria-hidden="true" />
            {t('user.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title={t('offline.logout_title')}
        description={t('offline.logout_text', { count: pending })}
        confirmLabel={t('offline.logout_confirm')}
        destructive
        onConfirm={() => logout.mutate()}
      />
    </>
  )
}
