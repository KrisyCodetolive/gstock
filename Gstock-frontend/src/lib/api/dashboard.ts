// Endpoints des modules M13 (tableau de bord) et M14 (journal d'activité).
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type { AuditLog, Dashboard, DashboardPeriod } from '@/types/dashboard'
import { http } from './client'

/** Tableau de bord d'une boutique, ou de toutes les boutiques (propriétaire) si `shopId` est null. */
export async function getDashboard(shopId: Id | null, period: DashboardPeriod): Promise<Dashboard> {
  const path = shopId === null ? '/dashboard' : `/shops/${shopId}/dashboard`
  return (await http.get<Resource<Dashboard>>(path, { period })).data
}

export function listAuditLogs(params: ListParams = {}): Promise<Paginated<AuditLog>> {
  return http.get<Paginated<AuditLog>>('/audit-logs', params)
}
