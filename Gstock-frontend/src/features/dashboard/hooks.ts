import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getDashboard, listAuditLogs } from '@/lib/api/dashboard'
import type { Id, ListParams } from '@/types/api'
import type { DashboardPeriod } from '@/types/dashboard'

/** `shopId` null : toutes les boutiques (propriétaire). */
export function useDashboard(shopId: Id | null | undefined, period: DashboardPeriod, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', shopId, period],
    queryFn: () => getDashboard(shopId ?? null, period),
    enabled: enabled && shopId !== undefined,
    placeholderData: keepPreviousData,
    // Les chiffres du jour bougent : on les rafraîchit à chaque retour sur l'accueil.
    staleTime: 0,
  })
}

export function useAuditLogs(params: ListParams) {
  return useQuery({ queryKey: ['audit', params], queryFn: () => listAuditLogs(params), placeholderData: keepPreviousData })
}
