import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMe } from '@/features/auth/hooks'
import { useOnline } from './network'
import { countsFor, useOfflineQueue } from './queue'
import { syncNow } from './sync'

/** Intervalle des nouvelles tentatives tant qu'il reste des opérations à envoyer. */
const RETRY_MS = 30_000

/** Opérations de la personne connectée : à envoyer, à vérifier. */
export function useOfflineCounts() {
  const me = useMe().data
  const operations = useOfflineQueue((s) => s.operations)
  return me ? countsFor(operations, me.user.id) : { pending: 0, review: 0 }
}

/**
 * Synchronisation automatique (ADR-005) : au démarrage, au retour du réseau et toutes
 * les 30 s s'il reste des opérations. Annonce le résultat (envoyées, à vérifier).
 */
export function useAutoSync() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const me = useMe().data
  const online = useOnline()
  const { pending } = useOfflineCounts()
  const userId = me?.user.id
  const before = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (userId === undefined || pending === 0) return
    const run = () => {
      const ops = useOfflineQueue.getState().operations
      before.current = new Set(ops.filter((o) => o.status === 'pending').map((o) => o.offline_uuid))
      void syncNow(queryClient, userId).then(() => {
        const done = useOfflineQueue.getState().operations.filter((o) => before.current.has(o.offline_uuid) && o.status !== 'pending' && o.status !== 'syncing')
        if (done.length === 0) return
        const review = done.filter((o) => o.status === 'to_review' || o.status === 'rejected').length
        if (review > 0) toast.warning(t('offline.synced_review', { count: review }))
        else toast.success(t('offline.synced', { count: done.length }))
      })
    }
    run()
    const timer = setInterval(run, RETRY_MS)
    return () => clearInterval(timer)
  }, [userId, online, pending, queryClient, t])
}
