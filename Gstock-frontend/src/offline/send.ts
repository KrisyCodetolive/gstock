// Envoie une opération faisable hors ligne, ou la garde sur l'appareil si le réseau manque
// (ADR-005). Le même offline_uuid sert aux deux : le serveur ne l'enregistre jamais deux fois.
import { ApiError } from '@/lib/api/client'
import { isOnline } from './network'
import { useOfflineQueue, type NewOperation, type OfflineOperation } from './queue'

export type Sent<T> = { kind: 'online'; data: T } | { kind: 'offline'; operation: OfflineOperation }

export async function sendOrKeep<T>(send: () => Promise<T>, operation: NewOperation): Promise<Sent<T>> {
  if (isOnline()) {
    try {
      return { kind: 'online', data: await send() }
    } catch (error) {
      // Coupure pendant l'envoi : on garde l'opération (même offline_uuid) au lieu de la perdre.
      if (!(error instanceof ApiError && error.status === 0)) throw error
    }
  }
  return { kind: 'offline', operation: useOfflineQueue.getState().enqueue(operation) }
}
