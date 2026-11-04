// États communs à tous les écrans : chargement, erreur, vide (§3.5).
import { CircleAlert, CloudOff, Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api/client'
import { useOnline } from '@/offline/network'

/** Squelettes aux mêmes formes que les cartes de liste. */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation()
  // Sans réseau, une donnée jamais reçue ne viendra pas : on le dit au lieu de charger sans fin.
  const online = useOnline()
  if (!online) return <MessageBlock icon={CloudOff} title={t('offline.no_cache_title')} text={t('offline.no_cache_text')} />
  return (
    <div className="grid gap-3" role="status" aria-label={t('states.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-lg border-2 border-muted" />
      ))}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  const message = error instanceof ApiError ? error.message : t('states.error_title')
  return (
    <MessageBlock
      icon={CircleAlert}
      tone="danger"
      title={t('states.error_title')}
      text={message}
      action={onRetry && <Button variant="outline" onClick={onRetry}>{t('states.retry')}</Button>}
    />
  )
}

export function EmptyState({
  icon = Inbox,
  title,
  text,
  action,
}: {
  icon?: LucideIcon
  title: string
  text?: string
  action?: ReactNode
}) {
  return <MessageBlock icon={icon} title={title} text={text} action={action} />
}

export function MessageBlock({
  icon: Icon,
  title,
  text,
  action,
  tone = 'neutral',
}: {
  icon: LucideIcon
  title: string
  text?: string
  action?: ReactNode
  tone?: 'neutral' | 'danger'
}) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-3 px-4 py-10 text-center">
      <span
        className={
          tone === 'danger'
            ? 'grid size-16 place-items-center rounded-lg border-2 border-foreground bg-destructive-bg text-destructive'
            : 'grid size-16 place-items-center rounded-lg border-2 border-foreground bg-tint-lavender'
        }
      >
        <Icon className="size-8" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <h2 className="text-xl font-bold">{title}</h2>
      {text && <p className="text-muted-foreground">{text}</p>}
      {action}
    </div>
  )
}
