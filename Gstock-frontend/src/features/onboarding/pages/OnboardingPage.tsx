import { Check, ChevronRight, PartyPopper, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState, MessageBlock } from '@/components/states'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks'
import { apiErrorMessage } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { useDismissOnboarding, useOnboarding, useSkipOnboardingStep } from '../hooks'
import { ONBOARDING_STEPS } from '../steps'

const tints = { peach: 'bg-tint-peach', yellow: 'bg-tint-yellow', mint: 'bg-tint-mint', lavender: 'bg-tint-lavender' } as const

/** Assistant de démarrage du propriétaire : premiers produits, anciennes dettes, première vente (M00). */
export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useSession()
  const onboarding = useOnboarding()
  const skip = useSkipOnboardingStep()
  const dismiss = useDismissOnboarding()
  const sub = me.tenant.subscription

  if (onboarding.isPending) return <LoadingState rows={3} />
  if (onboarding.isError) return <ErrorState error={onboarding.error} onRetry={() => void onboarding.refetch()} />

  const { steps } = onboarding.data
  const done = steps.filter((s) => s.done || s.skipped).length

  return (
    <div className="grid gap-6">
      <PageHeader title={t('onboarding.title')} subtitle={t('onboarding.subtitle')} />

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span>{t('onboarding.progress', { done, total: steps.length })}</span>
          {sub.status === 'trial' && <span className="text-muted-foreground">{t('onboarding.trial', { count: sub.days_left })}</span>}
        </div>
        <div className="h-3 overflow-hidden rounded-full border-2 border-foreground bg-muted" aria-hidden="true">
          <div className="h-full bg-paid transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>

      {onboarding.data.completed && !onboarding.data.dismissed ? (
        <MessageBlock
          icon={PartyPopper}
          title={t('onboarding.finished_title')}
          text={t('onboarding.finished_text')}
          action={
            <Button asChild>
              <Link to="/">{t('onboarding.to_home')}</Link>
            </Button>
          }
        />
      ) : null}

      <ol className="grid gap-3">
        {steps.map((step, index) => {
          const meta = ONBOARDING_STEPS[step.id]
          const Icon = meta.icon
          const finished = step.done || step.skipped
          return (
            <li key={step.id} className={cn('pressable-lg grid gap-3 rounded-lg bg-card p-4', finished && 'opacity-80')}>
              <div className="flex items-start gap-3">
                <span className={cn('grid size-12 shrink-0 place-items-center rounded-sm', step.done ? 'bg-tint-mint' : tints[meta.tint])}>
                  {step.done ? <Check className="size-6 text-paid-ink" strokeWidth={3} aria-hidden="true" /> : <Icon className="size-6" strokeWidth={2.2} aria-hidden="true" />}
                </span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                    <span>
                      <span className="text-muted-foreground">{index + 1}.</span> {t(`onboarding.steps.${step.id}.title`)}
                    </span>
                    {step.done && <StatusBadge tone="paid">{t('onboarding.done')}</StatusBadge>}
                    {step.skipped && <StatusBadge>{t('onboarding.skipped')}</StatusBadge>}
                  </h2>
                  <p className="text-muted-foreground">{t(`onboarding.steps.${step.id}.text`)}</p>
                </div>
              </div>
              {!step.done && (
                <div className="flex flex-wrap gap-2 sm:pl-15">
                  <Button asChild variant={index === steps.findIndex((s) => !s.done && !s.skipped) ? 'action' : 'outline'}>
                    <Link to={meta.to}>
                      {t(`onboarding.steps.${step.id}.action`)}
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  </Button>
                  {!step.skipped && (
                    <Button
                      variant="ghost"
                      disabled={skip.isPending}
                      onClick={() => skip.mutate(step.id, { onError: (e) => toast.error(apiErrorMessage(e)) })}
                    >
                      {t('onboarding.skip')}
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {!onboarding.data.dismissed && (
        <Button
          variant="ghost"
          className="justify-self-start"
          disabled={dismiss.isPending}
          onClick={() =>
            dismiss.mutate(undefined, {
              onSuccess: () => {
                toast.success(t('onboarding.dismissed'))
                void navigate('/', { replace: true })
              },
              onError: (e) => toast.error(apiErrorMessage(e)),
            })
          }
        >
          <X aria-hidden="true" />
          {t('onboarding.dismiss')}
        </Button>
      )}
    </div>
  )
}
