import { Crown, Plus, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BackLink } from '@/components/BackLink'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { roleLabel } from '@/lib/roles'
import { useListParams } from '@/lib/use-list-params'
import type { RoleDetail } from '@/types/users'
import { useRoles } from '../hooks'

export function RolesListPage() {
  const { t } = useTranslation()
  const list = useListParams()
  const roles = useRoles(list.params)

  const name = (r: RoleDetail) => (
    <span className="inline-flex flex-wrap items-center gap-2">
      {r.is_owner && <Crown className="size-4 text-warn" aria-hidden="true" />}
      {roleLabel(r)}
      {r.is_owner && <StatusBadge tone="warn">{t('roles.owner_badge')}</StatusBadge>}
    </span>
  )
  const perms = (r: RoleDetail) => t('roles.permissions_count', { count: r.permissions.length })
  const users = (r: RoleDetail) => t('roles.users_count', { count: r.users_count })

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres" label={t('settings.back')} />
      <PageHeader
        title={t('roles.title')}
        subtitle={t('roles.subtitle')}
        actions={
          <Button asChild variant="action">
            <Link to="/parametres/roles/nouveau">
              <Plus strokeWidth={2.6} aria-hidden="true" />
              {t('roles.add')}
            </Link>
          </Button>
        }
      />
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('roles.search')} />

      {roles.isPending ? (
        <LoadingState />
      ) : roles.isError ? (
        <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
      ) : roles.data.data.length === 0 ? (
        list.search ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : (
          <EmptyState icon={ShieldCheck} title={t('roles.empty_title')} text={t('roles.empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('roles.title')}
            items={roles.data.data}
            getKey={(r) => r.id}
            to={(r) => `/parametres/roles/${r.id}`}
            columns={[
              { header: t('roles.columns.name'), cell: name },
              { header: t('roles.columns.description'), cell: (r) => r.description ?? '—', className: 'text-muted-foreground' },
              { header: t('roles.columns.permissions'), cell: perms },
              { header: t('roles.columns.users'), cell: users },
            ]}
            card={(r) => (
              <div className="grid gap-1">
                <span className="text-base font-bold">{name(r)}</span>
                {r.description && <span className="text-sm text-muted-foreground">{r.description}</span>}
                <span className="text-sm font-semibold">
                  {perms(r)} · {users(r)}
                </span>
              </div>
            )}
          />
          <Pagination page={roles.data.meta.current_page} lastPage={roles.data.meta.last_page} total={roles.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}
