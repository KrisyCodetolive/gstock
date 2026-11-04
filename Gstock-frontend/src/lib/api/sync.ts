// Endpoint de synchronisation des opérations faites hors ligne (ADR-005).
import type { Id, Resource } from '@/types/api'
import type { SyncOperationInput, SyncResult } from '@/types/sync'
import { http } from './client'

export async function syncOperations(shopId: Id, operations: SyncOperationInput[]): Promise<SyncResult[]> {
  const res = await http.post<Resource<SyncResult[]>>(`/shops/${shopId}/sync`, { operations })
  return res.data
}
