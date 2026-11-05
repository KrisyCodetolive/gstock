// Endpoints des transferts de stock entre boutiques (§7.12, M07).
import type { Id, ListParams, Resource } from '@/types/api'
import type { Transfer, TransferList, TransferPayload, TransferReceivePayload } from '@/types/stock'
import { http } from './client'

/** Transferts envoyés (`out`) ou reçus (`in`) par la boutique, ou les deux. */
export function listTransfers(shopId: Id, params: ListParams & { direction?: 'out' | 'in' } = {}): Promise<TransferList> {
  return http.get<TransferList>(`/shops/${shopId}/transfers`, params)
}

export async function getTransfer(shopId: Id, id: Id): Promise<Transfer> {
  return (await http.get<Resource<Transfer>>(`/shops/${shopId}/transfers/${id}`)).data
}

/** Envoi : le stock sort tout de suite de la boutique de départ. */
export async function sendTransfer(shopId: Id, payload: TransferPayload): Promise<Transfer> {
  return (await http.post<Resource<Transfer>>(`/shops/${shopId}/transfers`, payload)).data
}

/** Réception par la boutique d'arrivée. */
export async function receiveTransfer(shopId: Id, id: Id, payload: TransferReceivePayload): Promise<Transfer> {
  return (await http.post<Resource<Transfer>>(`/shops/${shopId}/transfers/${id}/receive`, payload)).data
}

/** Annulation avant réception, motif obligatoire (ADR-012). */
export async function cancelTransfer(shopId: Id, id: Id, reason: string): Promise<Transfer> {
  return (await http.post<Resource<Transfer>>(`/shops/${shopId}/transfers/${id}/cancel`, { reason })).data
}
