// Envoi de la file au serveur (ADR-005) : automatique au retour du réseau, au démarrage
// et à intervalle régulier ; idempotent grâce à offline_uuid.
import type { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'
import { getMe } from '@/lib/api/auth'
import { syncOperations } from '@/lib/api/sync'
import type { Id } from '@/types/api'
import type { SyncOperationInput } from '@/types/sync'
import { isOnline, useNetworkStore } from './network'
import { useOfflineQueue, type OfflineOperation } from './queue'

let running: Promise<void> | null = null

const toInput = (o: OfflineOperation) => ({ type: o.type, offline_uuid: o.offline_uuid, occurred_at: o.occurred_at, payload: o.payload }) as SyncOperationInput

/** Les données touchées par les opérations envoyées. */
const AFFECTED = ['pos', 'sales', 'stock', 'products', 'customers', 'credits', 'repayments', 'expenses', 'dashboard']

export function syncNow(queryClient: QueryClient, userId: Id): Promise<void> {
  if (running) return running
  running = (async () => {
    const queue = useOfflineQueue.getState()
    const pending = queue.operations.filter((o) => o.status === 'pending' && o.user_id === userId)
    if (pending.length === 0) return
    if (!isOnline()) {
      // Réseau présent mais serveur injoignable : un appel léger dit s'il répond de nouveau.
      if (!useNetworkStore.getState().browserOnline) return
      await getMe().catch(() => undefined)
      if (!isOnline()) return
    }
    let sent = false
    for (const shopId of [...new Set(pending.map((o) => o.shop_id))]) {
      const batch = pending.filter((o) => o.shop_id === shopId)
      const uuids = batch.map((o) => o.offline_uuid)
      queue.setStatus(uuids, 'syncing')
      try {
        useOfflineQueue.getState().applyResults(await syncOperations(shopId, batch.map(toInput)))
        sent = true
      } catch (error) {
        // Coupure pendant l'envoi : tout repart dans la file, rien n'est perdu.
        const message = error instanceof ApiError ? error.message : null
        const retry = !(error instanceof ApiError) || error.status === 0 || error.status === 401 || error.status === 402 || error.status >= 500
        useOfflineQueue.getState().setStatus(uuids, retry ? 'pending' : 'rejected', message)
        if (retry) break
      }
    }
    if (sent) for (const key of AFFECTED) void queryClient.invalidateQueries({ queryKey: [key] })
  })().finally(() => {
    running = null
  })
  return running
}
