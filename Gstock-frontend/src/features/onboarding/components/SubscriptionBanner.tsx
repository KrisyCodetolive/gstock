import { CircleAlert, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Logo } from '@/components/Logo'
import { MessageBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCan, useSession } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'

const SUBSCRIPTION_PATH = '/parametres/abonnement'
/** Le bandeau d'essai n'apparaît que sur les derniers jours. */
const TRIAL_WARNING_DAYS = 3

/** Bandeau en haut de l'application : fin d'essai proche, impayé, espace suspendu (M00). */
export function SubscriptionBanner() {
  const { t } = useTranslation()
  const can = useCan()
  const { subscription: s } = useSession().tenant

  let tone: 'warn' | 'danger'
  let text: string
  if (s.read_only) {
    tone = 'danger'
    text = t('banner.suspended')
  } else if (s.status === 'past_due') {
    tone = 'warn'
    text = t('banner.past_due', { count: s.days_left })
  } else if (s.status === 'trial' && s.days_left <= TRIAL_WARNING_DAYS) {
    tone = 'warn'
    text = t('banner.trial', { count: s.days_left })
  } else {
    return null
  }

  const Icon = tone === 'danger' ? CircleAlert : Clock
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-foreground px-4 py-2 text-sm font-semibold lg:px-8',
        tone === 'danger' ? 'bg-destructive-bg text-destructive' : 'bg-warn-bg text-warn',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{text}</span>
      {can('subscription.manage') ? (
        <Link to={SUBSCRIPTION_PATH} className="font-bold underline underline-offset-4">
          {t('banner.action')}
        </Link>
      ) : (
        <span>{t('banner.ask_owner')}</span>
      )}
    </div>
  )
}

/** Écran de suspension : la caisse est bloquée tant que l'abonnement n'est pas réglé. */
export function RequireWritable({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const can = useCan()
  const { subscription } = useSession().tenant
  if (!subscription.read_only) return children
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="grid gap-6">
        <Logo className="justify-self-center" />
        <MessageBlock
          icon={CircleAlert}
          tone="danger"
          title={t('read_only.title')}
          text={can('subscription.manage') ? t('read_only.text') : `${t('read_only.text')} ${t('read_only.ask_owner')}`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/">{t('nav.home')}</Link>
              </Button>
              {can('subscription.manage') && (
                <Button asChild variant="action">
                  <Link to={SUBSCRIPTION_PATH}>{t('read_only.action')}</Link>
                </Button>
              )}
            </div>
          }
        />
      </div>
    </div>
  )
}
