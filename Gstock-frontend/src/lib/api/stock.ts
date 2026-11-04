// Endpoints du module M07 : stock d'une boutique, mouvements, ajustements.
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type { Adjustment, AdjustmentPayload, StockList, StockMovement, StockOverviewItem } from '@/types/stock'
import { http } from './client'

export function listShopStock(shopId: Id, params: ListParams = {}): Promise<StockList> {
  return http.get<StockList>(`/shops/${shopId}/stock`, params)
}

/** Produits en stock faible ou en rupture. */
export function listStockAlerts(shopId: Id, params: ListParams = {}): Promise<StockList> {
  return http.get<StockList>(`/shops/${shopId}/stock/alerts`, params)
}

/** Vue « Toutes mes boutiques ». */
export function listStockOverview(params: ListParams = {}): Promise<Paginated<StockOverviewItem>> {
  return http.get<Paginated<StockOverviewItem>>('/stock', params)
}

export function listMovements(shopId: Id, params: ListParams & { productId?: Id } = {}): Promise<Paginated<StockMovement>> {
  const { productId, ...rest } = params
  return http.get<Paginated<StockMovement>>(`/shops/${shopId}/stock/movements`, { ...rest, product_id: productId })
}

export async function getAdjustment(shopId: Id, id: Id): Promise<Adjustment> {
  return (await http.get<Resource<Adjustment>>(`/shops/${shopId}/adjustments/${id}`)).data
}

export async function createAdjustment(shopId: Id, payload: AdjustmentPayload): Promise<Adjustment> {
  return (await http.post<Resource<Adjustment>>(`/shops/${shopId}/adjustments`, payload)).data
}

/** Annulation avec motif obligatoire : jamais de suppression (ADR-012). */
export async function cancelAdjustment(shopId: Id, id: Id, reason: string): Promise<Adjustment> {
  return (await http.post<Resource<Adjustment>>(`/shops/${shopId}/adjustments/${id}/cancel`, { reason })).data
}
