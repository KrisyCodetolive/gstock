import { Plus, ShieldCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BackLink } from '@/components/BackLink'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { useCan } from '@/features/auth/hooks'
import { useRoles } from '@/features/roles/hooks'
import { formatShortDate } from '@/lib/format'
import { roleLabel } from '@/lib/roles'
import { useListParams } from '@/lib/use-list-params'
import type { UserDetail } from '@/types/users'
import { useUsers } from '../hooks'

const ALL = 'all'

export function UsersListPage() {
  const { t } = useTranslation()
  const can = useCan()
  const list = useListParams(['role_id'])
  const users = useUsers(list.params)
  const roles = useRoles({ per_page: 100 })

  const staffRoles = roles.data?.data.filter((r) => !r.is_owner) ?? []
  const filtered = Boolean(list.search || list.filter.role_id)

  const fullName = (u: UserDetail) => `${u.firstname} ${u.lastname}`
  const shops = (u: UserDetail) =>
    u.role.is_owner ? t('users.all_shops') : u.shops.length ? u.shops.map((s) => s.name).join(', ') : t('users.no_shop')
  const status = (u: UserDetail) =>
    u.is_active ? <StatusBadge tone="paid">{t('users.active')}</StatusBadge> : <StatusBadge tone="danger">{t('users.inactive')}</StatusBadge>
  const lastLogin = (u: UserDetail) => (u.last_login_at ? formatShortDate(u.last_login_at) : t('users.never_logged'))

  const addButton = (
    <Button asChild variant="action">
      <Link to="/parametres/utilisateurs/nouveau">
        <Plus strokeWidth={2.6} aria-hidden="true" />
        {t('users.add')}
      </Link>
    </Button>
  )

  // Pour ajouter un collaborateur, il faut d'abord au moins un rôle (ADR-014).
  const needsRole = roles.isSuccess && staffRoles.length === 0

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres" label={t('settings.back')} />
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} actions={!needsRole && addButton} />

      {needsRole && (
        <EmptyState
          icon={ShieldCheck}
          title={t('users.no_role_title')}
          text={t('users.no_role_text')}
          action={
            can('roles.manage') && (
              <Button asChild variant="action">
                <Link to="/parametres/roles/nouveau">{t('users.create_role')}</Link>
              </Button>
            )
          }
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('users.search')} />
        <div className="sm:w-64">
          <Select value={list.filter.role_id ?? ALL} onValueChange={(v) => list.setFilter('role_id', v === ALL ? undefined : v)}>
            <SelectTrigger aria-label={t('users.filter_role')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('users.all_roles')}</SelectItem>
              {roles.data?.data.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {users.isPending ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.data.length === 0 ? (
        filtered ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : (
          <EmptyState icon={Users} title={t('users.empty_title')} text={t('users.empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('users.title')}
            items={users.data.data}
            getKey={(u) => u.id}
            to={(u) => `/parametres/utilisateurs/${u.id}`}
            columns={[
              { header: t('users.columns.name'), cell: fullName },
              { header: t('users.columns.role'), cell: (u) => roleLabel(u.role) },
              { header: t('users.columns.shops'), cell: shops, className: 'max-w-64' },
              { header: t('users.columns.last_login'), cell: lastLogin, className: 'text-muted-foreground' },
              { header: t('users.columns.status'), cell: status },
            ]}
            card={(u) => (
              <div className="flex items-center gap-3">
                <UserAvatar user={u} />
                <div className="grid min-w-0 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-base font-bold">
                    {fullName(u)}
                    {!u.is_active && status(u)}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {roleLabel(u.role)} · {shops(u)}
                  </span>
                </div>
              </div>
            )}
          />
          <Pagination page={users.data.meta.current_page} lastPage={users.data.meta.last_page} total={users.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}
