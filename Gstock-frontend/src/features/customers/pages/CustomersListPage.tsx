import { Plus, Users } from 'lucide-react'
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
import type { Customer } from '@/types/customers'
import { useCustomers } from '../hooks'

export function CustomersListPage() {
  const { t } = useTranslation()
  const can = useCan()
  const list = useListParams(['doit'])
  const debtors = list.filter.doit === '1'
  const customers = useCustomers({ ...list.params, filter: { has_balance: debtors ? 'true' : undefined } })

  const due = (c: Customer) =>
    Number(c.balance) > 0 ? (
      <Money value={c.balance} className="text-destructive" />
    ) : (
      <span className="text-sm text-muted-foreground">{t('customers.nothing_due')}</span>
    )

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        actions={
          can('customers.create') && (
            <Button asChild variant="action">
              <Link to="/clients/nouveau">
                <Plus strokeWidth={2.6} aria-hidden="true" />
                {t('customers.add')}
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('customers.search')} />
        <div className="inline-flex self-start rounded-md border-2 border-foreground bg-card p-1" role="group">
          {[
            { value: undefined, label: t('customers.filter_all') },
            { value: '1', label: t('customers.filter_debtors') },
          ].map((opt) => {
            const active = list.filter.doit === opt.value
            return (
              <button
                key={opt.label}
                type="button"
                aria-pressed={active}
                onClick={() => list.setFilter('doit', opt.value)}
                className={cn('min-h-10 rounded-sm px-4 text-sm font-bold', active ? 'bg-foreground text-background' : 'hover:bg-muted')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {customers.isPending ? (
        <LoadingState rows={5} />
      ) : customers.isError ? (
        <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />
      ) : customers.data.data.length === 0 ? (
        list.search ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : debtors ? (
          <EmptyState icon={Users} title={t('customers.debtors_empty_title')} text={t('customers.debtors_empty_text')} />
        ) : (
          <EmptyState icon={Users} title={t('customers.empty_title')} text={t('customers.empty_text')} />
        )
      ) : (
        <>
          <DataList
            label={t('customers.title')}
            items={customers.data.data}
            getKey={(c) => c.id}
            to={(c) => `/clients/${c.id}`}
            columns={[
              {
                header: t('customers.columns.name'),
                cell: (c) => (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {c.name}
                    {!c.is_active && <StatusBadge>{t('customers.inactive')}</StatusBadge>}
                  </span>
                ),
              },
              { header: t('customers.columns.phone'), cell: (c) => c.phone ?? '—', className: 'tabular' },
              { header: t('customers.columns.district'), cell: (c) => c.district ?? '—', className: 'text-muted-foreground' },
              { header: t('customers.columns.due'), cell: due },
            ]}
            card={(c) => (
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0">
                  <span className="truncate text-base font-bold">{c.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {[c.phone ?? t('customers.no_phone'), c.district].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="grid shrink-0 justify-items-end">
                  {Number(c.balance) > 0 && <span className="text-xs font-semibold text-muted-foreground">{t('customers.due')}</span>}
                  {due(c)}
                </div>
              </div>
            )}
          />
          <Pagination page={customers.data.meta.current_page} lastPage={customers.data.meta.last_page} total={customers.data.meta.total} onPage={list.setPage} />
        </>
      )}
    </div>
  )
}
