import { ClipboardList, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/auth/hooks'
import { useListParams } from '@/lib/use-list-params'
import { cn } from '@/lib/utils'
import type { Supplier } from '@/types/purchases'
import { useSuppliers } from '../hooks'

export function SuppliersListPage() {
  const { t } = useTranslation()
  const can = useCan()
  const list = useListParams(['du'])
  const suppliers = useSuppliers({ ...list.params, filter: { has_due: list.filter.du === '1' ? 'true' : undefined } })

  const due = (s: Supplier) =>
    Number(s.due_total) > 0 ? <Money value={s.due_total} className="text-destructive" /> : <span className="text-sm text-muted-foreground">{t('suppliers.nothing_due')}</span>

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        actions={
          can('suppliers.manage') && (
            <Button asChild variant="action">
              <Link to="/fournisseurs/nouveau">
                <Plus strokeWidth={2.6} aria-hidden="true" />
                {t('suppliers.add')}
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('suppliers.search')} />
        <div className="inline-flex self-start rounded-md border-2 border-foreground bg-card p-1" role="group">
          {[
            { value: undefined, label: t('suppliers.filter_all') },
            { value: '1', label: t('suppliers.filter_due') },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={list.filter.du === o.value}
              onClick={() => list.setFilter('du', o.value)}
              className={cn('min-h-10 rounded-sm px-4 text-sm font-bold', list.filter.du === o.value ? 'bg-foreground text-background' : 'hover:bg-muted')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {suppliers.isPending ? (
        <LoadingState rows={4} />
      ) : suppliers.isError ? (
        <ErrorState error={suppliers.error} onRetry={() => void suppliers.refetch()} />
      ) : suppliers.data.data.length === 0 ? (
        list.search || list.filter.du ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : (
          <EmptyState icon={ClipboardList} title={t('suppliers.empty_title')} text={t('suppliers.empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('suppliers.title')}
            items={suppliers.data.data}
            getKey={(s) => s.id}
            to={(s) => `/fournisseurs/${s.id}`}
            columns={[
              {
                header: t('suppliers.columns.name'),
                cell: (s) => (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {s.name}
                    {!s.is_active && <StatusBadge>{t('suppliers.inactive')}</StatusBadge>}
                  </span>
                ),
              },
              { header: t('suppliers.columns.phone'), cell: (s) => s.phone ?? '—', className: 'tabular text-muted-foreground' },
              { header: t('suppliers.columns.purchased'), cell: (s) => <Money value={s.purchased_total} /> },
              { header: t('suppliers.columns.paid'), cell: (s) => <Money value={s.paid_total} className="text-paid-ink" /> },
              { header: t('suppliers.columns.due'), cell: due },
            ]}
            card={(s) => (
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0">
                  <span className="truncate font-bold">{s.name}</span>
                  <span className="truncate text-sm text-muted-foreground">{[s.phone, s.address].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="shrink-0">{due(s)}</div>
              </div>
            )}
          />
          <Pagination page={suppliers.data.meta.current_page} lastPage={suppliers.data.meta.last_page} total={suppliers.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}
