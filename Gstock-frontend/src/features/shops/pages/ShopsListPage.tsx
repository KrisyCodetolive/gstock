import { Plus, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BackLink } from '@/components/BackLink'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useListParams } from '@/lib/use-list-params'
import type { Shop } from '@/types/settings'
import { useSettings } from '@/features/settings/hooks'
import { useCan } from '@/features/auth/hooks'
import { useShops } from '../hooks'

const place = (s: Shop) => [s.district, s.city].filter(Boolean).join(', ')

export function ShopsListPage() {
  const { t } = useTranslation()
  const can = useCan()
  const list = useListParams()
  const shops = useShops(list.params)
  const settings = useSettings(can('settings.manage'))

  const status = (s: Shop) =>
    s.is_active ? <StatusBadge tone="paid">{t('shops.open')}</StatusBadge> : <StatusBadge>{t('shops.closed')}</StatusBadge>

  const openCount = shops.data?.data.filter((s) => s.is_active).length

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres" label={t('settings.back')} />
      <PageHeader
        title={t('shops.title')}
        subtitle={
          settings.data && openCount !== undefined && !list.search
            ? t('shops.usage', { count: openCount, max: settings.data.plan.max_shops })
            : undefined
        }
        actions={
          <Button asChild variant="action">
            <Link to="/parametres/boutiques/nouvelle">
              <Plus strokeWidth={2.6} aria-hidden="true" />
              {t('shops.add')}
            </Link>
          </Button>
        }
      />
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('shops.search')} />

      {shops.isPending ? (
        <LoadingState />
      ) : shops.isError ? (
        <ErrorState error={shops.error} onRetry={() => void shops.refetch()} />
      ) : shops.data.data.length === 0 ? (
        list.search ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : (
          <EmptyState icon={Store} title={t('shops.empty_title')} text={t('shops.empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('shops.title')}
            items={shops.data.data}
            getKey={(s) => s.id}
            to={(s) => `/parametres/boutiques/${s.id}`}
            columns={[
              { header: t('shops.columns.name'), cell: (s) => s.name },
              { header: t('shops.columns.place'), cell: place },
              { header: t('shops.columns.phone'), cell: (s) => s.phone ?? '—', className: 'tabular' },
              { header: t('shops.columns.users'), cell: (s) => t('shops.users_count', { count: s.users_count }) },
              { header: t('shops.columns.status'), cell: status },
            ]}
            card={(s) => (
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold">{s.name}</span>
                  {status(s)}
                </div>
                <span className="text-sm text-muted-foreground">
                  {place(s)} · {t('shops.users_count', { count: s.users_count })}
                </span>
              </div>
            )}
          />
          <Pagination
            page={shops.data.meta.current_page}
            lastPage={shops.data.meta.last_page}
            total={shops.data.meta.total}
            onPage={list.setPage}
          />
        </>
      )}
    </div>
  )
}
