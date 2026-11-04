import { ChevronRight, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useOnboarding } from '../hooks'

/** Rappel de l'assistant sur l'accueil, tant que le propriétaire n'a pas terminé (M00). */
export function OnboardingCard() {
  const { t } = useTranslation()
  const onboarding = useOnboarding()
  if (!onboarding.data || onboarding.data.completed) return null
  const { steps } = onboarding.data
  const done = steps.filter((s) => s.done || s.skipped).length

  return (
    <Link to="/demarrage" className="pressable-lg flex items-center gap-3 rounded-lg bg-tint-yellow p-4 text-foreground">
      <span className="grid size-12 shrink-0 place-items-center rounded-sm border-2 border-foreground bg-card">
        <Rocket className="size-6" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-lg font-bold">{t('onboarding.card_title')}</span>
        <span className="text-sm font-semibold">{t('onboarding.card_text', { count: done, done, total: steps.length })}</span>
        <span className="h-2 overflow-hidden rounded-full border-2 border-foreground bg-card" aria-hidden="true">
          <span className="block h-full bg-paid" style={{ width: `${(done / steps.length) * 100}%` }} />
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
    </Link>
  )
}
