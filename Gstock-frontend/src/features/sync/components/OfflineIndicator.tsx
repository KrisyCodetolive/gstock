import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { useOfflineCounts } from '@/offline/hooks'
import { useOnline } from '@/offline/network'

/**
 * Indicateur de connexion et de synchronisation (M08) : hors ligne, opérations à envoyer,
 * opérations à vérifier. Il mène à la page de synchronisation ; rien ne s'affiche si tout va bien.
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const { t } = useTranslation()
  const online = useOnline()
  const { pending, review } = useOfflineCounts()
  if (online && pending === 0 && review === 0) return null

  const parts = [!online && t('offline.status_offline'), pending > 0 && t('offline.status_pending', { count: pending }), review > 0 && t('offline.status_review', { count: review })].filter(Boolean)
  const Icon = !online ? CloudOff : review > 0 ? TriangleAlert : RefreshCw
  return (
    <Link
      to="/synchronisation"
      aria-label={`${parts.join(', ')}. ${t('offline.indicator_label')}`}
      className={cn(
        'pressable inline-flex min-h-10 items-center gap-1.5 rounded-sm px-2.5 text-sm font-bold whitespace-nowrap',
        !online || review > 0 ? 'bg-warn-bg text-warn' : 'bg-tint-lavender text-foreground',
        className,
      )}
    >
      <Icon className={cn('size-4 shrink-0', online && pending > 0 && review === 0 && 'animate-spin [animation-duration:2s]')} aria-hidden="true" />
      <span className="truncate">{parts.join(' · ')}</span>
    </Link>
  )
}

/** Bandeau sans réseau : on peut continuer à vendre (ADR-005). */
export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="flex items-center gap-3 border-b-2 border-foreground bg-warn-bg px-4 py-2 text-sm font-semibold text-warn lg:px-8">
      <CloudOff className="size-5 shrink-0" aria-hidden="true" />
      <span>{t('offline.banner')}</span>
    </div>
  )
}
