// File des opérations faites sans réseau (ADR-005) : ventes, remboursements en espèces,
// dépenses. Gardée dans IndexedDB ; chaque opération porte son offline_uuid et une
// référence provisoire (HL-N) jusqu'à ce que le serveur attribue la définitive.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Id, IsoDate, Money } from '@/types/api'
import type { RepaymentPayload } from '@/types/credits'
import type { ExpensePayload } from '@/types/purchases'
import type { SalePayload } from '@/types/sales'
import type { OfflineOperationType, SyncResult } from '@/types/sync'
import { idbStorage } from './storage'

export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'to_review' | 'rejected'

interface Base {
  offline_uuid: string
  shop_id: Id
  shop_name: string
  /** Auteur : seules ses opérations sont envoyées avec sa session. */
  user_id: Id
  occurred_at: IsoDate
  provisional_reference: string
  /** Montant affiché sur l'appareil : provisoire, le serveur recalcule (§7.4). */
  amount: Money
  /** Client ou catégorie, pour reconnaître l'opération dans la liste. */
  label: string | null
  status: OperationStatus
  attempts: number
  last_error: string | null
  result: SyncResult | null
  synced_at: IsoDate | null
}

export type OfflineOperation =
  | (Base & { type: 'sale'; payload: SalePayload })
  | (Base & { type: 'repayment'; payload: RepaymentPayload })
  | (Base & { type: 'expense'; payload: ExpensePayload })

export type NewOperation = Omit<OfflineOperation, keyof Pick<Base, 'provisional_reference' | 'status' | 'attempts' | 'last_error' | 'result' | 'synced_at'>> & {
  type: OfflineOperationType
}

/** Ce que l'écran sait de l'opération, pour la reconnaître dans la file. */
export interface OfflineContext {
  shopName: string
  userId: Id
  label: string | null
}

/** Opérations envoyées gardées pour l'historique de l'appareil. */
const KEEP_SYNCED = 30

interface QueueState {
  operations: OfflineOperation[]
  counter: number
  enqueue: (op: NewOperation) => OfflineOperation
  setStatus: (uuids: string[], status: OperationStatus, error?: string | null) => void
  applyResults: (results: SyncResult[]) => void
  remove: (uuid: string) => void
  clearSynced: () => void
}

export const useOfflineQueue = create<QueueState>()(
  persist(
    (set, get) => ({
      operations: [],
      counter: 1,
      enqueue: (input) => {
        const n = get().counter
        const op = {
          ...input,
          provisional_reference: `HL-${n}`,
          status: 'pending',
          attempts: 0,
          last_error: null,
          result: null,
          synced_at: null,
        } as OfflineOperation
        set((s) => ({ operations: [...s.operations, op], counter: n + 1 }))
        return op
      },
      setStatus: (uuids, status, error = null) =>
        set((s) => ({
          operations: s.operations.map((o) =>
            uuids.includes(o.offline_uuid) ? { ...o, status, last_error: error, attempts: status === 'syncing' ? o.attempts + 1 : o.attempts } : o,
          ),
        })),
      applyResults: (results) =>
        set((s) => {
          const now = new Date().toISOString()
          const operations = s.operations.map((o) => {
            const r = results.find((x) => x.offline_uuid === o.offline_uuid)
            if (!r) return o
            const status: OperationStatus = r.status === 'rejected' ? 'rejected' : r.status === 'to_review' ? 'to_review' : 'synced'
            return { ...o, status, result: r, last_error: r.message, synced_at: status === 'rejected' ? null : now }
          })
          // On ne garde que les dernières opérations envoyées sans écart.
          const synced = operations.filter((o) => o.status === 'synced')
          const drop = new Set(synced.slice(0, Math.max(0, synced.length - KEEP_SYNCED)).map((o) => o.offline_uuid))
          return { operations: operations.filter((o) => !drop.has(o.offline_uuid)) }
        }),
      remove: (uuid) => set((s) => ({ operations: s.operations.filter((o) => o.offline_uuid !== uuid) })),
      clearSynced: () => set((s) => ({ operations: s.operations.filter((o) => o.status !== 'synced') })),
    }),
    {
      name: 'gstock.offline.queue',
      storage: createJSONStorage(() => idbStorage),
      // Une opération restée « en cours d'envoi » (page fermée) repart dans la file.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const stuck = state.operations.filter((o) => o.status === 'syncing').map((o) => o.offline_uuid)
        if (stuck.length) state.setStatus(stuck, 'pending')
      },
    },
  ),
)

/** Opérations de l'utilisateur par état, pour l'indicateur et la page de synchronisation. */
export function countsFor(operations: OfflineOperation[], userId: Id) {
  const mine = operations.filter((o) => o.user_id === userId)
  return {
    pending: mine.filter((o) => o.status === 'pending' || o.status === 'syncing').length,
    review: mine.filter((o) => o.status === 'to_review' || o.status === 'rejected').length,
  }
}
