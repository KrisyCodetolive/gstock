import { HandCoins, Hourglass, UserMinus, UsersRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { LoadingState } from '@/components/states'
import { formatShortDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Id } from '@/types/api'
import type { CustomersReport, LostDays, ReportCustomer, ReportQuery } from '@/types/reports'
import { useCustomersReport } from '../hooks'
import { ReportError, Section, Segmented, Tile } from './ReportParts'

type Ranking = 'revenue' | 'visits' | 'margin'

const amount = (v: string) => Number(v).toLocaleString('fr-FR')

/** Onglet Clients des rapports (M15) : seules les ventes rattachées à un client comptent. */
export function CustomersTab({ shopId, query }: { shopId: Id | null | undefined; query: ReportQuery }) {
  const { t } = useTranslation()
  const [lostDays, setLostDays] = useState<LostDays>(60)
  const [ranking, setRanking] = useState<Ranking>('revenue')
  const report = useCustomersReport(shopId, query, lostDays)

  if (report.isPending) return <LoadingState rows={5} />
  if (report.isError) return <ReportError error={report.error} onRetry={() => void report.refetch()} />
  const r = report.data
  const salesCount = r.known_sales.count + r.anonymous_sales.count
  const knownShare = salesCount > 0 ? Math.round((r.known_sales.count / salesCount) * 100) : null
  const ranked = [...r.top]
    .filter((c) => ranking !== 'margin' || c.margin !== null)
    .sort((a, b) => Number(b[ranking] ?? 0) - Number(a[ranking] ?? 0))
    .slice(0, 10)

  return (
    <div className={cn('grid gap-6', report.isFetching && 'opacity-70')}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t('reports.customers.new')}>
          <span className="tabular text-[22px] leading-tight font-bold">{r.new_customers}</span>
          <span className="text-sm text-muted-foreground">{t('reports.customers.new_hint')}</span>
        </Tile>
        <Tile label={t('reports.customers.known')}>
          <span className="tabular text-[22px] leading-tight font-bold">{knownShare === null ? '—' : `${knownShare} %`}</span>
          <span className="text-sm text-muted-foreground">
            {t('reports.customers.known_hint', { known: r.known_sales.count, count: salesCount })}
          </span>
        </Tile>
        <Tile label={t('reports.customers.recovery')}>
          <span className="tabular text-[22px] leading-tight font-bold">{r.recovery.rate === null ? '—' : `${r.recovery.rate.toLocaleString('fr-FR')} %`}</span>
          <span className="text-sm text-muted-foreground">
            {t('reports.customers.recovery_hint', { repaid: amount(r.recovery.repaid), credited: amount(r.recovery.credited) })}
          </span>
        </Tile>
        <Tile label={t('reports.customers.remaining')}>
          <Money value={r.debt_aging.total} size="md" />
          <span className="text-sm text-muted-foreground">{t('reports.customers.remaining_hint')}</span>
        </Tile>
      </div>

      <Section icon={UsersRound} title={t('reports.customers.top_title')} hint={t('reports.customers.top_hint')}>
        <Segmented
          label={t('reports.products.rank_by')}
          value={ranking}
          onChange={setRanking}
          options={(['revenue', 'visits', 'margin'] as const).map((v) => ({ value: v, label: t(`reports.customers.rank.${v}`) }))}
        />
        {ranked.length === 0 ? (
          <p className="text-muted-foreground">{t('reports.customers.top_empty')}</p>
        ) : (
          <ol className="grid gap-2">
            {ranked.map((c, i) => (
              <CustomerRow key={c.customer.id} customer={c.customer} to={`/clients/${c.customer.id}`} rank={i + 1} sub={t('reports.customers.last_at', { date: formatShortDate(c.last_at) })}>
                <span className="grid justify-items-end text-right">
                  {ranking === 'visits' ? (
                    <span className="tabular font-bold">{t('reports.customers.visits', { count: c.visits })}</span>
                  ) : ranking === 'margin' ? (
                    <Money value={c.margin!} />
                  ) : (
                    <Money value={c.revenue} />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {ranking === 'visits'
                      ? t('reports.customers.revenue_short', { amount: amount(c.revenue) })
                      : t('reports.customers.visits_basket', { count: c.visits, basket: amount(c.average_basket) })}
                  </span>
                </span>
              </CustomerRow>
            ))}
          </ol>
        )}
      </Section>

      <Section icon={UserMinus} title={t('reports.customers.lost_title')} hint={t('reports.customers.lost_hint', { count: r.lost.min_visits })}>
        <Segmented
          label={t('reports.customers.lost_since')}
          value={lostDays}
          onChange={setLostDays}
          options={([30, 60, 90] as const).map((d) => ({ value: d, label: t('reports.products.days', { count: d }) }))}
        />
        {r.lost.count === 0 ? (
          <p className="text-muted-foreground">{t('reports.customers.lost_empty', { count: r.lost.days })}</p>
        ) : (
          <>
            <p className="font-semibold">{t('reports.customers.lost_total', { count: r.lost.count })}</p>
            <ul className="grid gap-2">
              {r.lost.items.map((c) => (
                <CustomerRow key={c.customer.id} customer={c.customer} to={`/clients/${c.customer.id}`} sub={c.customer.phone ?? undefined}>
                  <span className="grid justify-items-end text-right">
                    <Money value={c.revenue} />
                    <span className="text-sm text-muted-foreground">
                      {t('reports.customers.visits', { count: c.visits })} · {t('reports.customers.last_at', { date: formatShortDate(c.last_at) })}
                    </span>
                  </span>
                </CustomerRow>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section icon={Hourglass} title={t('reports.customers.aging_title')} hint={t('reports.customers.aging_hint')}>
        {Number(r.debt_aging.total) === 0 ? (
          <p className="text-muted-foreground">{t('reports.customers.aging_empty')}</p>
        ) : (
          <>
            <Aging report={r} />
            <h3 className="font-bold">{t('reports.customers.biggest_debtors')}</h3>
            <ul className="grid gap-2">
              {r.debt_aging.top.map((d) => (
                <CustomerRow key={d.customer.id} customer={d.customer} to={`/credits/clients/${d.customer.id}`} sub={t('reports.customers.since', { date: formatShortDate(d.oldest_at) })}>
                  <Money value={d.remaining} />
                </CustomerRow>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section icon={HandCoins} title={t('reports.customers.payers_title')} hint={t('reports.customers.payers_hint', { days: r.payers.late_days })}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-2">
            <h3 className="font-bold">{t('reports.customers.late_title')}</h3>
            {r.payers.late.length === 0 ? (
              <p className="text-muted-foreground">{t('reports.customers.late_empty')}</p>
            ) : (
              <ul className="grid gap-2">
                {r.payers.late.map((p) => (
                  <CustomerRow key={p.customer.id} customer={p.customer} to={`/credits/clients/${p.customer.id}`}>
                    <span className="grid justify-items-end gap-0.5 text-right">
                      <Money value={p.remaining} />
                      <StatusBadge tone="danger">
                        {Number(p.overdue) > 0
                          ? t('reports.customers.overdue', { amount: amount(p.overdue) })
                          : t('reports.customers.old_debt', { date: formatShortDate(p.oldest_at) })}
                      </StatusBadge>
                    </span>
                  </CustomerRow>
                ))}
              </ul>
            )}
          </div>
          <div className="grid content-start gap-2">
            <h3 className="font-bold">{t('reports.customers.good_title')}</h3>
            {r.payers.good.length === 0 ? (
              <p className="text-muted-foreground">{t('reports.customers.good_empty')}</p>
            ) : (
              <ul className="grid gap-2">
                {r.payers.good.map((p) => (
                  <CustomerRow key={p.customer.id} customer={p.customer} to={`/credits/clients/${p.customer.id}`}>
                    <span className="grid justify-items-end text-right">
                      <Money value={p.paid} className="text-paid-ink" />
                      <span className="text-sm text-muted-foreground">{t('reports.customers.payments', { count: p.payments })}</span>
                    </span>
                  </CustomerRow>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </div>
  )
}

/** Reste à payer par âge : une ligne par tranche, avec sa part du total (la couleur suit l'état, jamais seule). */
function Aging({ report }: { report: CustomersReport }) {
  const { t } = useTranslation()
  const total = Number(report.debt_aging.total)
  const tone = { under_30: 'bg-primary', '30_60': 'bg-warn', over_60: 'bg-destructive' } as const
  return (
    <ul className="grid gap-3">
      {report.debt_aging.buckets.map((b) => {
        const share = total > 0 ? Math.round((Number(b.amount) / total) * 100) : 0
        return (
          <li key={b.key} className="grid gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{t(`reports.customers.age.${b.key}`)}</span>
              <span className="flex items-baseline gap-2">
                <Money value={b.amount} />
                <span className="text-sm text-muted-foreground">
                  {share} % · {t('reports.customers.debts', { count: b.count })}
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {share > 0 && <div className={cn('h-full rounded-full', tone[b.key])} style={{ width: `${share}%` }} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Ligne d'un client : initiale, nom, précision ; chiffres à droite ; mène à sa fiche. */
function CustomerRow({ customer, to, rank, sub, children }: { customer: ReportCustomer; to: string; rank?: number; sub?: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-muted">
        {rank !== undefined && <span className="tabular w-6 shrink-0 text-center text-sm font-extrabold text-muted-foreground">{rank}</span>}
        <span className="grid size-10 shrink-0 place-items-center rounded-sm border-2 border-foreground bg-tint-lavender text-lg font-extrabold" aria-hidden="true">
          {customer.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="truncate font-bold">{customer.name}</span>
          {sub && <span className="truncate text-sm text-muted-foreground">{sub}</span>}
        </span>
        {children}
      </Link>
    </li>
  )
}
