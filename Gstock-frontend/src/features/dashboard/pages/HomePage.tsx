import {
  AlarmClock,
  AlertTriangle,
  Banknote,
  Boxes,
  ChevronRight,
  HandCoins,
  PackagePlus,
  Scale,
  ShoppingCart,
  Truck,
  UserPlus,
  Wallet,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ActionCard } from '@/components/ActionCard'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { useAllowedNav } from '@/app/layout/useAllowedNav'
import { useCan, useSession } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Permission } from '@/types/auth'
import type { ActivityItem, Dashboard, DashboardPeriod } from '@/types/dashboard'
import { useDashboard } from '../hooks'

const PERIODS: DashboardPeriod[] = ['today', 'week', 'month']

/**
 * Accueil (M13) : le tableau de bord pour qui peut le voir, sinon les actions rapides.
 * Tous les chiffres viennent du serveur (§7.8).
 */
export function HomePage() {
  const { t } = useTranslation()
  const can = useCan()
  const { user } = useSession()
  const { shop } = useCurrentShop()

  return (
    <div className="grid gap-6">
      <PageHeader title={t('home.hello', { name: user.firstname })} subtitle={shop ? `${shop.name} · ${t('home.intro')}` : t('home.intro')} />
      {can('dashboard.view') ? <DashboardView /> : <QuickActionsFromNav />}
    </div>
  )
}

/** Accueil sans tableau de bord : les rubriques autorisées en actions rapides. */
function QuickActionsFromNav() {
  const { t } = useTranslation()
  const actions = useAllowedNav().filter((item) => item.description)
  return (
    <section className="grid gap-3" aria-labelledby="quick-actions">
      <h2 id="quick-actions" className="text-xl font-bold">
        {t('home.quick_actions')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((item) => (
          <li key={item.id}>
            <ActionCard to={item.path} icon={item.icon} title={t(item.label)} description={item.description && t(item.description)} tint={item.tint} className="h-full" />
          </li>
        ))}
      </ul>
    </section>
  )
}

function DashboardView() {
  const { t } = useTranslation()
  const { role, shops } = useSession()
  const { shop } = useCurrentShop()
  const [period, setPeriod] = useState<DashboardPeriod>('today')
  // « Toutes mes boutiques » : propriétaire avec plusieurs boutiques (§3.6).
  const canSeeAll = role.is_owner && shops.length > 1
  const [all, setAll] = useState(false)
  const dashboard = useDashboard(all && canSeeAll ? null : shop?.id, period, true)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label={t('home.period')}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn('min-h-10 shrink-0 rounded-sm border-2 border-foreground px-3 text-sm font-bold whitespace-nowrap', period === p ? 'bg-foreground text-background' : 'bg-card')}
            >
              {t(`home.periods.${p}`)}
            </button>
          ))}
        </div>
        {canSeeAll && (
          <div className="inline-flex rounded-md border-2 border-foreground bg-card p-1" role="group" aria-label={t('home.scope')}>
            {[
              { v: false, label: t('home.scope_shop') },
              { v: true, label: t('home.scope_all') },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={all === o.v}
                onClick={() => setAll(o.v)}
                className={cn('min-h-9 rounded-sm px-3 text-sm font-bold', all === o.v ? 'bg-foreground text-background' : 'hover:bg-muted')}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {dashboard.isPending ? (
        <LoadingState rows={4} />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      ) : (
        <div className={cn('grid gap-6', dashboard.isFetching && 'opacity-70')}>
          <Cards data={dashboard.data} period={period} />
          <QuickActions />
          <Installments data={dashboard.data} />
          <Recent items={dashboard.data.recent} linkable={!all} />
        </div>
      )}
    </>
  )
}

function StatCard({ to, onClick, icon: Icon, label, tone, children }: { to?: string; onClick?: () => void; icon: LucideIcon; label: string; tone?: 'danger' | 'warn' | 'paid'; children: ReactNode }) {
  const className = 'pressable-lg grid h-full content-start gap-1 rounded-lg bg-card p-4 text-left'
  const content = (
    <>
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
        <span className="flex items-center gap-2">
          <Icon className={cn('size-5', tone === 'danger' && 'text-destructive', tone === 'warn' && 'text-warn', tone === 'paid' && 'text-paid-ink')} aria-hidden="true" />
          {label}
        </span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </span>
      {children}
    </>
  )
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

/** Les six cartes du M13, selon les permissions ; chacune ouvre sa liste. */
function Cards({ data, period }: { data: Dashboard; period: DashboardPeriod }) {
  const { t } = useTranslation()
  const can = useCan()
  const [resultOpen, setResultOpen] = useState(false)
  const pct = data.sales.change_percent
  const has = (...p: Permission[]) => p.every((x) => can(x))

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('home.cards.sales')}>
      {has('sales.view') && (
        <StatCard to={`/ventes?periode=${period}`} icon={ShoppingCart} label={t('home.cards.sales')}>
          <Money value={data.sales.total} size="lg" />
          <span className="text-sm text-muted-foreground">
            {t('home.cards.sales_count', { count: data.sales.count })}
            {Number(data.sales.on_credit) > 0 && ` · ${t('home.cards.on_credit', { amount: Number(data.sales.on_credit).toLocaleString('fr-FR') })}`}
          </span>
          {pct !== null && (
            <span className={cn('text-sm font-bold', pct >= 0 ? 'text-paid-ink' : 'text-destructive')}>
              {t(period === 'today' ? 'home.cards.vs_yesterday' : 'home.cards.vs_previous', { sign: pct >= 0 ? '+' : '−', value: Math.abs(pct) })}
            </span>
          )}
        </StatCard>
      )}
      {has('sales.view') && (
        <StatCard to={`/ventes?periode=${period}`} icon={Banknote} label={t('home.cards.money_in')} tone="paid">
          <Money value={data.money_in.total} size="lg" className="text-paid-ink" />
          <span className="text-xs text-muted-foreground">{t('home.cards.money_in_hint')}</span>
          {data.money_in.by_method.length > 0 && (
            <ul className="mt-1 grid gap-0.5 text-sm">
              {data.money_in.by_method.map((m) => (
                <li key={m.method.id} className="flex justify-between gap-2">
                  <span>{m.method.name}</span>
                  <Money value={m.amount} className="text-sm" />
                </li>
              ))}
            </ul>
          )}
        </StatCard>
      )}
      {has('stock.view') && (
        <StatCard to="/stock?state=low" icon={AlertTriangle} label={t('home.cards.low_stock')} tone={data.stock.low + data.stock.out > 0 ? 'warn' : undefined}>
          <span className="tabular text-[32px] leading-tight font-bold">{data.stock.low + data.stock.out}</span>
          <span className="text-sm text-muted-foreground">
            {t('home.cards.low_stock_value', { count: data.stock.low + data.stock.out })}
            {data.stock.out > 0 && ` · ${t('home.cards.out_of_stock', { count: data.stock.out })}`}
          </span>
        </StatCard>
      )}
      {has('credits.view') && (
        <StatCard to="/credits" icon={WalletCards} label={t('home.cards.credits')} tone={Number(data.credits.remaining) > 0 ? 'danger' : undefined}>
          <Money value={data.credits.remaining} size="lg" className={Number(data.credits.remaining) > 0 ? 'text-destructive' : undefined} />
          <span className="text-sm text-muted-foreground">{t('home.cards.credits_value', { count: data.credits.debtors })}</span>
        </StatCard>
      )}
      {has('expenses.view') && (
        <StatCard to={`/depenses?periode=${period}`} icon={Wallet} label={t('home.cards.expenses')}>
          <Money value={data.money_out.expenses} size="lg" />
          {Number(data.money_out.customer_refunds) > 0 && (
            <span className="text-sm text-muted-foreground">{t('home.cards.refunds', { amount: Number(data.money_out.customer_refunds).toLocaleString('fr-FR') })}</span>
          )}
        </StatCard>
      )}
      {has('sales.view', 'expenses.view') && (
        <StatCard onClick={() => setResultOpen(true)} icon={Scale} label={t('home.cards.result')} tone={Number(data.result.amount) >= 0 ? 'paid' : 'danger'}>
          <Money value={data.result.amount} size="lg" className={Number(data.result.amount) >= 0 ? 'text-paid-ink' : 'text-destructive'} />
          <span className="text-xs text-muted-foreground">{t('home.cards.result_hint')}</span>
          {!data.result.complete && <span className="text-xs font-semibold text-warn">{t('home.cards.result_incomplete')}</span>}
        </StatCard>
      )}

      <ResponsiveSheet open={resultOpen} onOpenChange={setResultOpen} title={t('home.cards.result')} description={t('home.cards.result_hint')}>
        <dl className="grid gap-2 text-[15px]">
          <div className="flex justify-between gap-2">
            <dt>{t('home.cards.sales')}</dt>
            <dd>
              <Money value={data.sales.total} />
            </dd>
          </div>
          <div className="flex justify-between gap-2 text-muted-foreground">
            <dt>− {t('home.cards.cost_of_goods')}</dt>
            <dd>
              <Money value={data.result.cost_of_goods} />
            </dd>
          </div>
          <div className="flex justify-between gap-2 text-muted-foreground">
            <dt>− {t('home.cards.expenses')}</dt>
            <dd>
              <Money value={data.money_out.expenses} />
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-t-2 border-foreground pt-2 text-lg font-bold">
            <dt>{t('home.cards.result')}</dt>
            <dd>
              <Money value={data.result.amount} size="md" />
            </dd>
          </div>
          {!data.result.complete && <p className="text-sm font-semibold text-warn">{t('home.cards.result_incomplete')}</p>}
        </dl>
      </ResponsiveSheet>
    </section>
  )
}

/** Actions rapides du M13, selon les permissions. */
function QuickActions() {
  const { t } = useTranslation()
  const can = useCan()
  const actions: { to: string; icon: LucideIcon; title: string; text: string; perm: Permission; tint: 'peach' | 'yellow' | 'mint' | 'lavender' }[] = [
    { to: '/vendre', icon: ShoppingCart, title: t('nav.sell'), text: t('home.sell_text'), perm: 'sales.create', tint: 'peach' },
    { to: '/produits/nouveau', icon: PackagePlus, title: t('home.add_product'), text: t('home.add_product_text'), perm: 'products.create', tint: 'yellow' },
    { to: '/clients/nouveau', icon: UserPlus, title: t('home.add_customer'), text: t('home.add_customer_text'), perm: 'customers.create', tint: 'mint' },
    { to: '/credits', icon: HandCoins, title: t('home.repay'), text: t('home.repay_text'), perm: 'repayments.create', tint: 'lavender' },
    { to: '/approvisionnements/nouveau', icon: Truck, title: t('home.add_purchase'), text: t('home.add_purchase_text'), perm: 'purchases.create', tint: 'mint' },
    { to: '/depenses?ajouter=1', icon: Wallet, title: t('home.add_expense'), text: t('home.add_expense_text'), perm: 'expenses.create', tint: 'peach' },
  ]
  const visible = actions.filter((a) => can(a.perm))
  if (visible.length === 0) return null
  return (
    <section className="grid gap-3" aria-labelledby="quick-actions">
      <h2 id="quick-actions" className="text-xl font-bold">
        {t('home.quick_actions')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((a) => (
          <li key={a.to}>
            <ActionCard to={a.to} icon={a.icon} title={a.title} description={a.text} tint={a.tint} className="h-full" />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Échéances en retard et à venir (7 jours). GStock ne relance jamais le client (§7.7). */
function Installments({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const can = useCan()
  if (!can('credits.view')) return null
  const { overdue, upcoming } = data.installments
  return (
    <section className="grid gap-3" aria-labelledby="installments">
      <h2 id="installments" className="text-xl font-bold">
        {t('home.installments')}
      </h2>
      {overdue.count === 0 && upcoming.count === 0 ? (
        <p className="text-muted-foreground">{t('home.installments_none')}</p>
      ) : (
        <Link to="/credits?vue=echeances" className="pressable-lg flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-card p-4">
          <AlarmClock className="size-6 text-destructive" aria-hidden="true" />
          {overdue.count > 0 && (
            <span className="grid">
              <span className="font-bold text-destructive">{t('home.installments_overdue', { count: overdue.count })}</span>
              <Money value={overdue.amount} className="text-sm" />
            </span>
          )}
          {upcoming.count > 0 && (
            <span className="grid">
              <span className="font-bold">{t('home.installments_upcoming', { count: upcoming.count })}</span>
              <Money value={upcoming.amount} className="text-sm" />
            </span>
          )}
          <ChevronRight className="ml-auto size-5 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}

const ACTIVITY_ICON: Record<ActivityItem['type'], LucideIcon> = {
  sale: ShoppingCart,
  sale_credit: WalletCards,
  repayment: HandCoins,
  opening_balance: WalletCards,
  purchase: Truck,
  expense: Wallet,
  adjustment: Boxes,
}

function activityLink(a: ActivityItem): string {
  switch (a.type) {
    case 'sale':
    case 'sale_credit':
      return `/ventes/${a.id}`
    case 'repayment':
      return `/credits/paiements/${a.id}`
    case 'opening_balance':
      return `/credits/clients/${a.customer_id}`
    case 'purchase':
      return `/approvisionnements/${a.id}`
    case 'expense':
      return '/depenses?periode=all'
    case 'adjustment':
      return `/stock/operations/${a.id}`
  }
}

/** Activité récente : chaque ligne ouvre son détail (dans la vue d'une boutique). */
function Recent({ items, linkable }: { items: ActivityItem[]; linkable: boolean }) {
  const { t } = useTranslation()
  return (
    <section className="grid gap-3" aria-labelledby="recent">
      <h2 id="recent" className="text-xl font-bold">
        {t('home.recent')}
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{t('home.recent_empty')}</p>
      ) : (
        <ul className="grid divide-y-2 divide-muted rounded-lg border-2 border-foreground bg-card p-2">
          {items.map((a) => {
            const Icon = ACTIVITY_ICON[a.type]
            const content = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-sm border-2 border-foreground bg-tint-lavender" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-bold">
                    {t(`home.activity.${a.type}`)} · {a.reference}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{[a.label, formatDateTime(a.occurred_at), a.user?.name].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="grid shrink-0 justify-items-end gap-1">
                  {a.amount && <Money value={a.amount} className={a.cancelled ? 'line-through opacity-60' : undefined} />}
                  {a.cancelled && <StatusBadge>{t('home.cancelled')}</StatusBadge>}
                </span>
              </>
            )
            return (
              <li key={`${a.type}-${a.id}`}>
                {linkable ? (
                  <Link to={activityLink(a)} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
