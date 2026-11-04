import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Money } from '@/components/Money'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types/subscription'

/** Contenu d'une offre : prix et limites (boutiques, utilisateurs, produits). */
function PlanContent({ plan, badge }: { plan: Plan; badge?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xl font-extrabold">{plan.name}</span>
        {badge ?? (plan.is_recommended && <StatusBadge tone="warn">{t('plans.recommended')}</StatusBadge>)}
      </span>
      <span className="text-sm text-muted-foreground">{plan.description}</span>
      <span>
        <Money value={plan.price} size="md" />
        <span className="ml-1 text-sm font-semibold text-muted-foreground">{plan.billing_period === 'yearly' ? t('plans.per_year') : t('plans.per_month')}</span>
      </span>
      <ul className="grid gap-1 text-[15px]">
        {[t('plans.shops', { count: plan.max_shops }), t('plans.users', { count: plan.max_users }), t('plans.products', { max: plan.max_products.toLocaleString('fr-FR') })].map((line) => (
          <li key={line} className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-paid-ink" strokeWidth={3} aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
    </>
  )
}

/** Offre à choisir dans une liste (bouton radio : un seul choix). */
export function PlanOption({ plan, selected, onSelect, badge }: { plan: Plan; selected: boolean; onSelect: () => void; badge?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'pressable grid h-full w-full content-start gap-2 rounded-lg bg-card p-4 text-left',
        selected && 'bg-tint-yellow outline-3 outline-offset-2 outline-primary',
      )}
    >
      <PlanContent plan={plan} badge={badge} />
    </button>
  )
}
