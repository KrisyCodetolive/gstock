// Endpoints du module M15 (rapports).
import type { Id, Resource } from '@/types/api'
import type { CustomersReport, DormantDays, LostDays, ProductsReport, ReportQuery, SalesReport } from '@/types/reports'
import { http } from './client'

/** Rapport d'une boutique, ou de toutes les boutiques (propriétaire) si `shopId` est null. */
const base = (shopId: Id | null) => (shopId === null ? '/reports' : `/shops/${shopId}/reports`)

export async function getSalesReport(shopId: Id | null, query: ReportQuery): Promise<SalesReport> {
  return (await http.get<Resource<SalesReport>>(`${base(shopId)}/sales`, { ...query })).data
}

export async function getProductsReport(shopId: Id | null, query: ReportQuery & { dormant_days: DormantDays }): Promise<ProductsReport> {
  return (await http.get<Resource<ProductsReport>>(`${base(shopId)}/products`, { ...query })).data
}

export async function getCustomersReport(shopId: Id | null, query: ReportQuery & { lost_days: LostDays }): Promise<CustomersReport> {
  return (await http.get<Resource<CustomersReport>>(`${base(shopId)}/customers`, { ...query })).data
}
