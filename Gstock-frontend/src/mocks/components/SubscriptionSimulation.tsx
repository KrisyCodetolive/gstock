// Outils de démonstration : faire avancer le temps pour voir les états de l'abonnement.
// Chargé seulement avec les données simulées (jamais dans le build de production).
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { currentTenant, GRACE_DAYS, persistPlatform, subscriptionOf } from '../platform'

const DAY = 86_400_000
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString()

export function SubscriptionSimulation() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const apply = (change: (sub: ReturnType<typeof subscriptionOf>) => void) => {
    change(subscriptionOf(currentTenant().slug))
    persistPlatform()
    void queryClient.invalidateQueries()
  }

  const actions = [
    { label: t('simulation.trial_end'), run: () => apply((s) => { s.ends_at = null; s.trial_ends_at = at(2) }) },
    { label: t('simulation.past_due'), run: () => apply((s) => { s.trial_ends_at = at(-40); s.ends_at = at(-2) }) },
    { label: t('simulation.suspend'), run: () => apply((s) => { s.trial_ends_at = at(-60); s.ends_at = at(-(GRACE_DAYS + 2)) }) },
    { label: t('simulation.restore'), run: () => apply((s) => { s.ends_at = at(30) }) },
  ]

  return (
    <section className="grid gap-3 rounded-lg border-2 border-dashed border-muted-foreground p-4" aria-labelledby="simulation-title">
      <div className="grid gap-1">
        <h2 id="simulation-title" className="flex items-center gap-2 text-lg font-bold">
          <FlaskConical className="size-5" aria-hidden="true" />
          {t('simulation.tools_title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('simulation.tools_text')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} variant="outline" size="sm" onClick={a.run}>
            {a.label}
          </Button>
        ))}
      </div>
    </section>
  )
}
