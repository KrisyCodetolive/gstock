import { BookOpenText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataList } from '@/components/DataList'
import { Pagination, SearchInput } from '@/components/ListControls'
import { PageHeader } from '@/components/PageHeader'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTime } from '@/lib/format'
import i18n from '@/lib/i18n'
import { useListParams } from '@/lib/use-list-params'
import type { AuditLog } from '@/types/dashboard'
import { useAuditLogs } from '../hooks'

const ALL = 'all'
const DOMAINS = ['sale', 'stock', 'credit', 'repayment', 'purchase', 'expense', 'role', 'user', 'payment_settings'] as const

/** Nom lisible d'un champ du journal (« argent_deja_recu » → « Argent déjà reçu »). */
const label = (key: string) =>
  i18n.t(`audit.fields.${key}` as 'audit.fields.total', { defaultValue: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') })

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>
  if (typeof value === 'boolean') return <span>{value ? 'Oui' : 'Non'}</span>
  if (typeof value === 'number') return <span className="tabular">{value.toLocaleString('fr-FR')}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>{i18n.t('audit.none')}</span>
    return (
      <ul className="grid gap-0.5">
        {value.map((v, i) => (
          <li key={i}>
            <Value value={v} />
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object') {
    return (
      <span>
        {Object.entries(value as Record<string, unknown>).map(([k, v], i) => (
          <span key={k}>
            {i > 0 && ' · '}
            {label(k)} : <Value value={v} />
          </span>
        ))}
      </span>
    )
  }
  return <span>{String(value)}</span>
}

function Values({ values }: { values: Record<string, unknown> | null }) {
  if (!values || Object.keys(values).length === 0) return <p className="text-muted-foreground">—</p>
  return (
    <dl className="grid gap-1 text-[15px]">
      {Object.entries(values).map(([k, v]) => (
        <div key={k} className="grid gap-0.5">
          <dt className="text-sm font-semibold text-muted-foreground">{label(k)}</dt>
          <dd>
            <Value value={v} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Journal d'activité (M14) : les actions sensibles, qui, quand, pourquoi, avant / après. */
export function AuditPage() {
  const { t } = useTranslation()
  const list = useListParams(['type'])
  const logs = useAuditLogs({ page: list.page, search: list.params.search, filter: { domain: list.filter.type } })
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const action = (a: AuditLog) => t(`audit.actions.${a.action}` as 'audit.actions.sale.cancelled', { defaultValue: a.action })

  return (
    <div className="grid gap-6">
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder={t('audit.search')} />
        <div className="sm:w-64">
          <Select value={list.filter.type ?? ALL} onValueChange={(v) => list.setFilter('type', v === ALL ? undefined : v)}>
            <SelectTrigger aria-label={t('audit.filter_domain')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('audit.all_domains')}</SelectItem>
              {DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {t(`audit.domains.${d}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {logs.isPending ? (
        <LoadingState rows={5} />
      ) : logs.isError ? (
        <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
      ) : logs.data.data.length === 0 ? (
        <EmptyState icon={BookOpenText} title={t('audit.empty_title')} text={t('audit.empty_text')} />
      ) : (
        <>
          <DataList
            label={t('audit.title')}
            items={logs.data.data}
            getKey={(a) => a.id}
            onSelect={setSelected}
            columns={[
              { header: t('audit.columns.date'), cell: (a) => formatDateTime(a.created_at) },
              { header: t('audit.columns.user'), cell: (a) => a.user?.name ?? '—' },
              { header: t('audit.columns.shop'), cell: (a) => a.shop?.name ?? t('audit.no_shop'), className: 'text-muted-foreground' },
              { header: t('audit.columns.action'), cell: action },
              { header: t('audit.columns.subject'), cell: (a) => a.subject?.label ?? '—' },
              { header: t('audit.columns.reason'), cell: (a) => a.reason ?? '—', className: 'max-w-64 truncate text-muted-foreground' },
            ]}
            card={(a) => (
              <div className="grid gap-0.5">
                <span className="font-bold">
                  {action(a)}
                  {a.subject && ` · ${a.subject.label}`}
                </span>
                <span className="text-sm text-muted-foreground">{[formatDateTime(a.created_at), a.user?.name, a.shop?.name].filter(Boolean).join(' · ')}</span>
                {a.reason && <span className="truncate text-sm">« {a.reason} »</span>}
              </div>
            )}
          />
          <Pagination page={logs.data.meta.current_page} lastPage={logs.data.meta.last_page} total={logs.data.meta.total} onPage={list.setPage} />
        </>
      )}

      <ResponsiveSheet
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? `${action(selected)}${selected.subject ? ` · ${selected.subject.label}` : ''}` : t('audit.detail.title')}
        description={selected ? t('audit.detail.by', { name: selected.user?.name ?? '—', date: formatDateTime(selected.created_at) }) : undefined}
      >
        {selected && (
          <div className="grid gap-5">
            <p className="text-sm text-muted-foreground">{selected.shop?.name ?? t('audit.no_shop')}</p>
            {selected.reason && (
              <section className="grid gap-1">
                <h3 className="text-sm font-bold">{t('audit.detail.reason')}</h3>
                <p>{selected.reason}</p>
              </section>
            )}
            <section className="grid gap-1 rounded-md border-2 border-muted p-3">
              <h3 className="text-sm font-bold">{t('audit.detail.before')}</h3>
              <Values values={selected.old_values} />
            </section>
            <section className="grid gap-1 rounded-md border-2 border-foreground p-3">
              <h3 className="text-sm font-bold">{t('audit.detail.after')}</h3>
              <Values values={selected.new_values} />
            </section>
          </div>
        )}
      </ResponsiveSheet>
    </div>
  )
}
