// Contrat de la synchronisation hors ligne (ADR-005, M08) : POST /shops/{shop_id}/sync.
import type { Id, IsoDate } from './api'
import type { RepaymentPayload } from './credits'
import type { ExpensePayload } from './purchases'
import type { SalePayload } from './sales'

export type OfflineOperationType = 'sale' | 'repayment' | 'expense'

export type SyncOperationInput =
  | { type: 'sale'; offline_uuid: string; occurred_at: IsoDate; payload: SalePayload }
  | { type: 'repayment'; offline_uuid: string; occurred_at: IsoDate; payload: RepaymentPayload }
  | { type: 'expense'; offline_uuid: string; occurred_at: IsoDate; payload: ExpensePayload }

export interface SyncPayload {
  operations: SyncOperationInput[]
}

/**
 * Résultat par opération, dans l'ordre d'envoi :
 * - `created` : enregistrée, référence définitive attribuée ;
 * - `duplicate` : déjà reçue (même offline_uuid), rien n'est enregistré deux fois ;
 * - `to_review` : enregistrée, mais avec un écart à vérifier (stock, prix) ;
 * - `rejected` : impossible à enregistrer (client supprimé, droit retiré…) ; gardée sur l'appareil.
 */
export interface SyncResult {
  offline_uuid: string
  type: OfflineOperationType
  status: 'created' | 'duplicate' | 'to_review' | 'rejected'
  resource: { id: Id; reference: string } | null
  message: string | null
  reasons: string[]
}
