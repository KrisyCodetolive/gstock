// Endpoints du module M08 : caisse, ventes, reçus.
import type { Id, ListParams, Resource } from '@/types/api'
import type { PosBootstrap, Receipt, Sale, SalePayload, SaleQuote, SaleQuoteInput, SalesList, ShareLink } from '@/types/sales'
import { http } from './client'

export async function getPosBootstrap(shopId: Id): Promise<PosBootstrap> {
  return (await http.get<Resource<PosBootstrap>>(`/shops/${shopId}/pos/bootstrap`)).data
}

/** Montants calculés par le serveur, sans rien enregistrer (§7.4). */
export async function quoteSale(shopId: Id, input: SaleQuoteInput): Promise<SaleQuote> {
  return (await http.post<Resource<SaleQuote>>(`/shops/${shopId}/sales/quote`, input)).data
}

export async function createSale(shopId: Id, payload: SalePayload): Promise<Sale> {
  return (await http.post<Resource<Sale>>(`/shops/${shopId}/sales`, payload)).data
}

export function listSales(shopId: Id, params: ListParams = {}): Promise<SalesList> {
  return http.get<SalesList>(`/shops/${shopId}/sales`, params)
}

export async function getSale(shopId: Id, id: Id): Promise<Sale> {
  return (await http.get<Resource<Sale>>(`/shops/${shopId}/sales/${id}`)).data
}

/** Annulation avec motif obligatoire : stock restitué, crédit annulé (ADR-012). */
export async function cancelSale(shopId: Id, id: Id, reason: string): Promise<Sale> {
  return (await http.post<Resource<Sale>>(`/shops/${shopId}/sales/${id}/cancel`, { reason })).data
}

export async function getReceipt(shopId: Id, id: Id): Promise<Receipt> {
  return (await http.get<Resource<Receipt>>(`/shops/${shopId}/sales/${id}/receipt`)).data
}

/** Lien signé et expirant pour partager le reçu sur WhatsApp (ADR-013). */
export async function createShareLink(shopId: Id, id: Id): Promise<ShareLink> {
  return (await http.post<Resource<ShareLink>>(`/shops/${shopId}/sales/${id}/share-link`)).data
}

/** Reçu public ouvert depuis le lien partagé, sans connexion. */
export async function getPublicReceipt(token: string): Promise<Receipt> {
  return (await http.get<Resource<Receipt>>(`/public/receipts/${token}`)).data
}
