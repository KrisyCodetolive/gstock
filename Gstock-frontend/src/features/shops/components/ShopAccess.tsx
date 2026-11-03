import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FormSection } from '@/components/FormLayout'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { useCan } from '@/features/auth/hooks'
import { useUsers } from '@/features/users/hooks'
import { roleLabel } from '@/lib/roles'
import type { Id } from '@/types/api'

/** « Qui a accès à cette boutique ? » depuis la fiche boutique (M04). */
export function ShopAccess({ shopId }: { shopId: Id }) {
  const { t } = useTranslation()
  const can = useCan()
  const canManageUsers = can('users.manage')
  const users = useUsers({ per_page: 100, filter: { shop_id: shopId } })

  return (
    <FormSection title={t('shops.access.title')}>
      {users.isPending ? (
        <LoadingState rows={2} />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.data.length <= 1 ? (
        <p className="text-muted-foreground">{t('shops.access.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {users.data.data.map((u) => {
            const content = (
              <>
                <UserAvatar user={u} />
                <span className="grid min-w-0 flex-1">
                  <span className="font-bold">
                    {u.firstname} {u.lastname}
                  </span>
                  <span className="text-sm text-muted-foreground">{roleLabel(u.role)}</span>
                </span>
                {!u.is_active && <StatusBadge tone="danger">{t('users.inactive')}</StatusBadge>}
              </>
            )
            return (
              <li key={u.id}>
                {canManageUsers ? (
                  <Link to={`/parametres/utilisateurs/${u.id}`} className="flex min-h-14 items-center gap-3 rounded-md px-2 hover:bg-muted">
                    {content}
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 px-2">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </FormSection>
  )
}
