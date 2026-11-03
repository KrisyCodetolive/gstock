import { List, Plus } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BackLink } from '@/components/BackLink'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { PageHeader } from '@/components/PageHeader'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import type { ReferentialItem, ReferentialResource } from '@/lib/api/referentials'
import { useListParams } from '@/lib/use-list-params'
import { useReferentialList } from '../hooks'

export interface ReferentialFormProps<R extends ReferentialResource> {
  item?: ReferentialItem<R>
  onDone: () => void
}

/**
 * Écran commun aux référentiels (M05) : liste cherchable, ajout et modification
 * dans un panneau. Pas de suppression : on désactive.
 */
export function ReferentialPage<R extends ReferentialResource>({
  resource,
  texts,
  details,
  leading,
  notice,
  Form,
}: {
  resource: R
  texts: { title: string; subtitle: string; add: string; edit: string; search: string; emptyTitle: string; emptyText: string }
  /** Informations propres au référentiel (type, conversion…). */
  details?: (item: ReferentialItem<R>) => ReactNode
  /** Repère visuel avant le nom (pastille de couleur…). */
  leading?: (item: ReferentialItem<R>) => ReactNode
  notice?: ReactNode
  Form: ComponentType<ReferentialFormProps<R>>
}) {
  const { t } = useTranslation()
  const list = useListParams()
  const query = useReferentialList(resource, { ...list.params, sort: 'name' })
  // null : panneau fermé ; 'new' : ajout ; sinon l'élément modifié.
  const [editing, setEditing] = useState<ReferentialItem<R> | 'new' | null>(null)

  const status = (item: ReferentialItem<R>) =>
    item.is_active ? <StatusBadge tone="paid">{t('referentials.active')}</StatusBadge> : <StatusBadge>{t('referentials.inactive')}</StatusBadge>
  const name = (item: ReferentialItem<R>) => (
    <span className="inline-flex items-center gap-2">
      {leading?.(item)}
      {item.name}
    </span>
  )

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres" label={t('settings.back')} />
      <PageHeader
        title={texts.title}
        subtitle={texts.subtitle}
        actions={
          <Button variant="action" onClick={() => setEditing('new')}>
            <Plus strokeWidth={2.6} aria-hidden="true" />
            {texts.add}
          </Button>
        }
      />
      {notice}
      <SearchInput value={list.search} onChange={list.setSearch} placeholder={texts.search} />

      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        list.search ? (
          <EmptyState title={t('list.no_result_title')} text={t('list.no_result_text')} />
        ) : (
          <EmptyState icon={List} title={texts.emptyTitle} text={texts.emptyText} />
        )
      ) : (
        <>
          <DataList
            label={texts.title}
            items={query.data.data}
            getKey={(item) => item.id}
            onSelect={setEditing}
            columns={[
              { header: t('referentials.columns.name'), cell: name },
              ...(details ? [{ header: t('referentials.columns.details'), cell: details, className: 'text-muted-foreground' }] : []),
              { header: t('referentials.columns.status'), cell: status },
            ]}
            card={(item) => (
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold">{name(item)}</span>
                  {!item.is_active && status(item)}
                </div>
                {details && <span className="text-sm text-muted-foreground">{details(item)}</span>}
              </div>
            )}
          />
          <Pagination page={query.data.meta.current_page} lastPage={query.data.meta.last_page} total={query.data.meta.total} onPage={list.setPage} />
        </>
      )}

      <ResponsiveSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? texts.add : texts.edit}
      >
        {editing !== null && (
          <Form key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        )}
      </ResponsiveSheet>
    </div>
  )
}
